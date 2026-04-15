use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_updater::UpdaterExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HWND, POINT};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::{GetDC, GetPixel, ReleaseDC};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

// macOS platform implementation using CoreGraphics
#[cfg(target_os = "macos")]
mod macos_impl {
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGPoint { x: f64, y: f64 }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGSize { width: f64, height: f64 }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGRect { origin: CGPoint, size: CGSize }

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventCreate(source: *const std::ffi::c_void) -> *mut std::ffi::c_void;
        fn CGEventGetLocation(event: *const std::ffi::c_void) -> CGPoint;
        fn CGWindowListCreateImage(
            screenBounds: CGRect,
            listOption: u32,
            windowID: u32,
            imageOption: u32,
        ) -> *mut std::ffi::c_void;
        fn CGImageGetDataProvider(image: *const std::ffi::c_void) -> *const std::ffi::c_void;
        fn CGImageGetBitsPerPixel(image: *const std::ffi::c_void) -> usize;
        fn CGDataProviderCopyData(provider: *const std::ffi::c_void) -> *const std::ffi::c_void;
        fn CFRelease(cf: *const std::ffi::c_void);
        fn CFDataGetBytePtr(data: *const std::ffi::c_void) -> *const u8;
        fn CFDataGetLength(data: *const std::ffi::c_void) -> isize;
        fn CGEventSourceButtonState(stateID: u32, button: u32) -> bool;
    }

    /// Returns screen coordinates (top-left origin, Y increases downward).
    /// CGEventGetLocation already uses this system — no flip needed.
    pub fn get_cursor_pos() -> (i32, i32) {
        unsafe {
            let event = CGEventCreate(std::ptr::null());
            let pt = CGEventGetLocation(event);
            CFRelease(event);
            (pt.x as i32, pt.y as i32)
        }
    }

    /// Samples the pixel color at the given screen coordinates (top-left origin).
    /// CGWindowListCreateImage uses the same coordinate system as CGEventGetLocation.
    /// Requires Screen Recording permission on macOS 10.15+.
    pub fn pixel_color_at(x: i32, y: i32) -> String {
        unsafe {
            let rect = CGRect {
                origin: CGPoint { x: x as f64, y: y as f64 },
                size: CGSize { width: 1.0, height: 1.0 },
            };

            // kCGWindowListOptionOnScreenOnly = 1, kCGNullWindowID = 0, kCGWindowImageDefault = 0
            let img = CGWindowListCreateImage(rect, 1, 0, 0);
            if img.is_null() {
                return "#000000".to_string();
            }

            let provider = CGImageGetDataProvider(img);
            let data = CGDataProviderCopyData(provider);

            let color = if !data.is_null() {
                let len = CFDataGetLength(data);
                let bpp = CGImageGetBitsPerPixel(img);
                let bytes_per_pixel = bpp / 8;

                if bytes_per_pixel >= 3 && len >= bytes_per_pixel as isize {
                    let ptr = CFDataGetBytePtr(data);
                    let slice = std::slice::from_raw_parts(ptr, bytes_per_pixel);
                    // CGWindowListCreateImage produces BGRA pixel data on macOS.
                    let b = slice[0];
                    let g = slice[1];
                    let r = slice[2];
                    format!("#{:02X}{:02X}{:02X}", r, g, b)
                } else {
                    "#000000".to_string()
                }
            } else {
                "#000000".to_string()
            };

            if !data.is_null() {
                CFRelease(data);
            }
            CFRelease(img);
            color
        }
    }

    /// Returns true if the left mouse button is currently held down.
    pub fn is_left_button_down() -> bool {
        // kCGEventSourceStateHIDSystemState = 1, kCGMouseButtonLeft = 0
        unsafe { CGEventSourceButtonState(1, 0) }
    }
}

// Platform-agnostic wrappers

#[cfg(target_os = "windows")]
fn platform_get_cursor_pos() -> (i32, i32) {
    let mut pt = POINT { x: 0, y: 0 };
    unsafe { let _ = GetCursorPos(&mut pt); }
    (pt.x, pt.y)
}

#[cfg(target_os = "macos")]
fn platform_get_cursor_pos() -> (i32, i32) {
    macos_impl::get_cursor_pos()
}

#[cfg(target_os = "windows")]
fn pixel_color_at(x: i32, y: i32) -> String {
    unsafe {
        let hdc = GetDC(HWND(std::ptr::null_mut()));
        let color = GetPixel(hdc, x, y);
        ReleaseDC(HWND(std::ptr::null_mut()), hdc);
        if color.0 == 0xFFFFFFFF {
            return "#000000".to_string();
        }
        let r = (color.0 & 0xFF) as u8;
        let g = ((color.0 >> 8) & 0xFF) as u8;
        let b = ((color.0 >> 16) & 0xFF) as u8;
        format!("#{:02X}{:02X}{:02X}", r, g, b)
    }
}

#[cfg(target_os = "macos")]
fn pixel_color_at(x: i32, y: i32) -> String {
    macos_impl::pixel_color_at(x, y)
}

#[cfg(target_os = "windows")]
fn platform_is_left_button_down() -> bool {
    (unsafe { GetAsyncKeyState(0x01) }) as u16 & 0x8000 != 0
}

#[cfg(target_os = "macos")]
fn platform_is_left_button_down() -> bool {
    macos_impl::is_left_button_down()
}

struct AppState {
    last_color: Mutex<Option<String>>,
}

fn launch_picker(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("picker") {
        let _ = w.close();
        return;
    }

    let Ok(picker) = tauri::WebviewWindowBuilder::new(
        app,
        "picker",
        tauri::WebviewUrl::App("/?window=picker".into()),
    )
    .inner_size(116.0, 34.0)
    .transparent(true)
    .always_on_top(true)
    .decorations(false)
    .skip_taskbar(true)
    .resizable(false)
    .shadow(false)
    .build()
    else {
        return;
    };

    let (cx, cy) = platform_get_cursor_pos();
    #[cfg(target_os = "windows")]
    let _ = picker.set_position(tauri::PhysicalPosition::<i32>::new(cx + 20, cy + 20));
    #[cfg(target_os = "macos")]
    let _ = picker.set_position(tauri::LogicalPosition::<f64>::new((cx + 20) as f64, (cy + 20) as f64));

    let app_esc = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_esc.global_shortcut().on_shortcut(
            Shortcut::new(None, Code::Escape),
            |app, _, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(w) = app.get_webview_window("picker") {
                        let _ = w.close();
                    }
                }
            },
        );
    });

    let app_clone = app.clone();
    std::thread::spawn(move || {
        // Esperar a que el click que abrió el picker se haya liberado
        std::thread::sleep(std::time::Duration::from_millis(200));
        let mut lbutton_was_down = false;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(16));

            let Some(window) = app_clone.get_webview_window("picker") else {
                break;
            };

            let lbutton_down = platform_is_left_button_down();
            if lbutton_down && !lbutton_was_down {
                do_confirm(&app_clone);
                break;
            }
            lbutton_was_down = lbutton_down;

            let (cx, cy) = platform_get_cursor_pos();

            let color = pixel_color_at(cx, cy);
            *app_clone.state::<AppState>().last_color.lock().unwrap() = Some(color.clone());
            let _ = window.emit("color-update", &color);

            #[cfg(target_os = "windows")]
            let _ = window.set_position(tauri::PhysicalPosition::<i32>::new(cx + 20, cy + 20));
            #[cfg(target_os = "macos")]
            let _ = window.set_position(tauri::LogicalPosition::<f64>::new((cx + 20) as f64, (cy + 20) as f64));
        }
    });
}

#[tauri::command]
fn open_picker(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        launch_picker(&app);
    });
}

fn do_confirm(app: &tauri::AppHandle) {
    let color = match app.state::<AppState>().last_color.lock().unwrap().clone() {
        Some(c) => c,
        None => return,
    };

    if let Ok(mut cb) = arboard::Clipboard::new() {
        let _ = cb.set_text(color.trim_start_matches('#'));
    }

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
        let _ = main.emit("color-picked", &color);
    }

    if let Some(picker) = app.get_webview_window("picker") {
        let _ = picker.close();
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) {
    if let Ok(updater) = app.updater() {
        if let Ok(Some(update)) = updater.check().await {
            let _ = update.download_and_install(|_, _| {}, || {}).await;
        }
    }
}

#[tauri::command]
fn get_last_color(state: tauri::State<AppState>) -> Option<String> {
    state.last_color.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { last_color: Mutex::new(None) })
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                tauri::WindowEvent::Destroyed => {
                    if window.label() == "picker" {
                        let app = window.app_handle().clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = app.global_shortcut().unregister(Shortcut::new(None, Code::Escape));
                        });
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let show = MenuItem::with_id(app, "show", "Open OKRA", true, None::<&str>)?;
            let hub = MenuItem::with_id(app, "hub", "Go to Color Hub", true, None::<&str>)?;
            let swatch = MenuItem::with_id(app, "swatch", "Pick a Color", true, Some("alt+c"))?;
            let quit = MenuItem::with_id(app, "quit", "Exit OKRA", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&swatch, &hub, &show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hub" => {
                        let _ = open::that("https://hub.okrapk.app");
                    }
                    "swatch" => {
                        launch_picker(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Autostart al iniciar sesión
            use tauri_plugin_autostart::ManagerExt;
            let _ = app.autolaunch().enable();

            // Buscar actualizaciones al inicio y cada 24 horas
            let app_update = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    if let Ok(updater) = app_update.updater() {
                        if let Ok(Some(update)) = updater.check().await {
                            let _ = app_update.emit("update-available", &update.version);
                        }
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(24 * 60 * 60)).await;
                }
            });

            // Alt+C: abre el picker, o lo cierra si ya está abierto
            app.global_shortcut().on_shortcut(
                Shortcut::new(Some(Modifiers::ALT), Code::KeyC),
                |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        launch_picker(app);
                    }
                },
            )?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_last_color, open_picker, install_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
