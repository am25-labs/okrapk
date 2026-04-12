import React from "react";
import "./App.css";
import ReactDOM from "react-dom/client";
import App from "./App";
import Picker from "./Picker";

const params = new URLSearchParams(window.location.search);
const isPicker = params.get("window") === "picker";

if (isPicker) {
  document.body.style.background = "transparent";
  document.documentElement.style.background = "transparent";
} else {
  document.body.style.background = "#000";
  document.documentElement.style.background = "#000";
}

const Component = isPicker ? Picker : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>,
);
