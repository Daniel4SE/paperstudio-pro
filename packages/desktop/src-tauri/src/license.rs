use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::constants::*;

// ── Types ──────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize, specta::Type, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub is_valid: bool,
    pub email: Option<String>,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct ActivateResponse {
    license_token: Option<String>,
    email: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct VerifyResponse {
    valid: bool,
    email: Option<String>,
    error: Option<String>,
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/// Get (or create) a stable device identifier, persisted in the license store.
fn get_or_create_device_id(app: &AppHandle) -> Result<String, String> {
    let store = app
        .store(LICENSE_STORE)
        .map_err(|e| format!("Failed to open license store: {e}"))?;

    if let Some(val) = store.get(LICENSE_DEVICE_ID_KEY) {
        if let Some(id) = val.as_str() {
            return Ok(id.to_string());
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    store.set(
        LICENSE_DEVICE_ID_KEY,
        serde_json::Value::String(id.clone()),
    );
    store
        .save()
        .map_err(|e| format!("Failed to save license store: {e}"))?;
    Ok(id)
}

// ── Tauri commands ─────────────────────────────────────────────────────────────

/// Check if a license token exists locally (does NOT contact the server).
#[tauri::command]
#[specta::specta]
pub fn get_license_status(app: AppHandle) -> LicenseStatus {
    let store = match app.store(LICENSE_STORE) {
        Ok(s) => s,
        Err(_) => {
            return LicenseStatus {
                is_valid: false,
                email: None,
                error: None,
            }
        }
    };

    let has_token = store
        .get(LICENSE_TOKEN_KEY)
        .and_then(|v| v.as_str().map(|s| !s.is_empty()))
        .unwrap_or(false);

    LicenseStatus {
        is_valid: has_token,
        email: None,
        error: None,
    }
}

/// Activate a license using an activation code obtained from the Google OAuth flow.
/// Calls the license server POST /api/activate.
#[tauri::command]
#[specta::specta]
pub async fn activate_license(
    app: AppHandle,
    activation_code: String,
) -> Result<LicenseStatus, String> {
    let device_id = get_or_create_device_id(&app)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let resp = client
        .post(format!("{}/api/activate", LICENSE_SERVER_URL))
        .json(&serde_json::json!({
            "activation_code": activation_code,
            "device_id": device_id,
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let body: ActivateResponse = resp
        .json()
        .await
        .map_err(|e| format!("Invalid response: {e}"))?;

    if let Some(token) = &body.license_token {
        let store = app
            .store(LICENSE_STORE)
            .map_err(|e| format!("Store error: {e}"))?;
        store.set(
            LICENSE_TOKEN_KEY,
            serde_json::Value::String(token.clone()),
        );
        store
            .save()
            .map_err(|e| format!("Failed to save: {e}"))?;

        Ok(LicenseStatus {
            is_valid: true,
            email: body.email,
            error: None,
        })
    } else {
        Ok(LicenseStatus {
            is_valid: false,
            email: None,
            error: body.error,
        })
    }
}

/// Verify the stored license token with the remote server.
#[tauri::command]
#[specta::specta]
pub async fn verify_license(app: AppHandle) -> Result<LicenseStatus, String> {
    let store = app
        .store(LICENSE_STORE)
        .map_err(|e| format!("Store error: {e}"))?;

    let token = store
        .get(LICENSE_TOKEN_KEY)
        .and_then(|v| v.as_str().map(String::from))
        .ok_or("No license token found")?;

    let device_id = get_or_create_device_id(&app)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let resp = client
        .post(format!("{}/api/verify", LICENSE_SERVER_URL))
        .json(&serde_json::json!({
            "license_token": token,
            "device_id": device_id,
        }))
        .send()
        .await;

    match resp {
        Ok(r) => {
            let body: VerifyResponse = r
                .json()
                .await
                .map_err(|e| format!("Invalid response: {e}"))?;
            Ok(LicenseStatus {
                is_valid: body.valid,
                email: body.email,
                error: body.error,
            })
        }
        Err(_) => {
            // Network error → allow offline use when a local token exists
            tracing::warn!("License server unreachable, allowing offline use");
            Ok(LicenseStatus {
                is_valid: true,
                email: None,
                error: None,
            })
        }
    }
}

// ── Startup helper (called from lib.rs) ────────────────────────────────────────

/// Check if the license is valid at startup.
/// Returns `true` if the app should proceed, `false` if the license window
/// must be shown first.
pub async fn check_license_on_startup(app: &AppHandle) -> bool {
    let status = get_license_status(app.clone());
    if !status.is_valid {
        return false;
    }

    // Attempt server verification; on network failure, allow offline use
    match verify_license(app.clone()).await {
        Ok(s) => s.is_valid,
        Err(_) => true,
    }
}
