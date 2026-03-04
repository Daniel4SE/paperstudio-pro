use tauri_plugin_window_state::StateFlags;

pub const SETTINGS_STORE: &str = "paperstudio.settings.dat";
pub const DEFAULT_SERVER_URL_KEY: &str = "defaultServerUrl";
pub const WSL_ENABLED_KEY: &str = "wslEnabled";
pub const UPDATER_ENABLED: bool = option_env!("TAURI_SIGNING_PRIVATE_KEY").is_some();

// License system constants
pub const LICENSE_STORE: &str = "paperstudio.license.dat";
pub const LICENSE_TOKEN_KEY: &str = "licenseToken";
pub const LICENSE_DEVICE_ID_KEY: &str = "deviceId";
pub const LICENSE_SERVER_URL: &str = "https://license.paperstudios.cc";

pub fn window_state_flags() -> StateFlags {
    StateFlags::all() - StateFlags::DECORATIONS - StateFlags::VISIBLE
}
