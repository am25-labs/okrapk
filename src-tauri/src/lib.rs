use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use windows::Win32::Foundation::{HWND, POINT};
use windows::Win32::Graphics::Gdi::{GetDC, GetPixel, ReleaseDC};
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

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

    let mut pt = POINT { x: 0, y: 0 };
    unsafe { let _ = GetCursorPos(&mut pt); }
    let _ = picker.set_position(tauri::PhysicalPosition::new(pt.x + 20, pt.y + 20));

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
        let mut lbutton_was_down = false;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(16));

            let Some(window) = app_clone.get_webview_window("picker") else {
                break;
            };

            let lbutton_down = unsafe { GetAsyncKeyState(0x01) } as u16 & 0x8000 != 0;
            if lbutton_down && !lbutton_was_down {
                do_confirm(&app_clone);
                break;
            }
            lbutton_was_down = lbutton_down;

            let mut pt = POINT { x: 0, y: 0 };
            unsafe { let _ = GetCursorPos(&mut pt); }

            let color = pixel_color_at(pt.x, pt.y);
            *app_clone.state::<AppState>().last_color.lock().unwrap() = Some(color.clone());
            let _ = window.emit("color-update", &color);

            let _ = window.set_position(tauri::PhysicalPosition::new(pt.x + 20, pt.y + 20));
        }
    });
}

#[tauri::command]
fn open_picker(app: tauri::AppHandle) {
    launch_picker(&app);
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
fn get_last_color(state: tauri::State<AppState>) -> Option<String> {
    state.last_color.lock().unwrap().clone()
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { last_color: Mutex::new(None) })
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
            let show = MenuItem::with_id(app, "show", "Abrir", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
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
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

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
        .invoke_handler(tauri::generate_handler![get_last_color, open_picker])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
