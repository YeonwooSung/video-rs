use std::time::{SystemTime, UNIX_EPOCH};

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::models::error::AppError;

/// Production verifying key (hex, 32 bytes). Rotate before a paid release
/// by replacing this constant and keeping the matching secret off-repo.
/// Derived from the Phase 1 development seed used only in tests / `issue_signed_license`.
#[allow(dead_code)]
pub const EMBEDDED_VERIFYING_KEY_HEX: &str =
    "8d5e6c8a0e6f0c8f3d3e1b2a9c7d6e5f4a3b2c1d0e1f2a3b4c5d6e7f8091a2b3";

#[cfg(any(test, debug_assertions))]
const DEV_SEED: [u8; 32] = [0x42; 32];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Entitlement {
    Free,
    Pro,
}

impl Entitlement {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Free => "free",
            Self::Pro => "pro",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LicenseFile {
    pub version: u32,
    pub product: String,
    pub tier: String,
    pub expires_unix: i64,
    pub seat: Option<String>,
    pub sig: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LicenseView {
    pub entitlement: Entitlement,
    pub expires_unix: Option<i64>,
    pub source: &'static str,
    pub error: Option<String>,
}

pub fn require_pro(view: &LicenseView) -> Result<(), AppError> {
    if view.entitlement == Entitlement::Pro {
        Ok(())
    } else {
        Err(AppError::License(
            view.error
                .clone()
                .unwrap_or_else(|| "a Pro license is required for timeline render".into()),
        ))
    }
}

pub fn entitlement_from_env_and_file(path: Option<&str>) -> LicenseView {
    if let Some(forced) = debug_force_tier_from(std::env::var("VIDEO_RS_FORCE_TIER").ok().as_deref())
    {
        return LicenseView {
            entitlement: forced,
            expires_unix: None,
            source: "env",
            error: None,
        };
    }
    match path {
        Some(p) if !p.trim().is_empty() => match load_license_file(p) {
            Ok(view) => view,
            Err(err) => LicenseView {
                entitlement: default_without_file(),
                expires_unix: None,
                source: "file",
                error: Some(err.to_string()),
            },
        },
        _ => LicenseView {
            entitlement: default_without_file(),
            expires_unix: None,
            source: if cfg!(debug_assertions) {
                "debug_default"
            } else {
                "none"
            },
            error: None,
        },
    }
}

fn default_without_file() -> Entitlement {
    if cfg!(debug_assertions) {
        Entitlement::Pro
    } else {
        Entitlement::Free
    }
}

fn debug_force_tier_from(raw: Option<&str>) -> Option<Entitlement> {
    if !cfg!(debug_assertions) {
        return None;
    }
    match raw {
        Some(v) if v.eq_ignore_ascii_case("free") => Some(Entitlement::Free),
        Some(v) if v.eq_ignore_ascii_case("pro") => Some(Entitlement::Pro),
        _ => None,
    }
}

pub fn load_license_file(path: &str) -> Result<LicenseView, AppError> {
    let raw = std::fs::read_to_string(path)?;
    verify_license_json(&raw, &embedded_verifying_key()?)
}

pub fn verify_license_json(raw: &str, key: &VerifyingKey) -> Result<LicenseView, AppError> {
    let file: LicenseFile = serde_json::from_str(raw)?;
    verify_license(&file, key)
}

pub fn verify_license(file: &LicenseFile, key: &VerifyingKey) -> Result<LicenseView, AppError> {
    if file.version != 1 {
        return Err(AppError::License(format!(
            "unsupported license version {}",
            file.version
        )));
    }
    if file.product != "video-rs" {
        return Err(AppError::License("license product is not video-rs".into()));
    }
    let sig_bytes = hex::decode(file.sig.trim()).map_err(|_| {
        AppError::License("license signature is not hex".into())
    })?;
    let sig = Signature::from_slice(&sig_bytes)
        .map_err(|_| AppError::License("license signature is invalid".into()))?;
    key.verify(message_bytes(file).as_bytes(), &sig)
        .map_err(|_| AppError::License("license signature check failed".into()))?;

    if file.tier != "pro" {
        return Ok(LicenseView {
            entitlement: Entitlement::Free,
            expires_unix: Some(file.expires_unix),
            source: "file",
            error: None,
        });
    }
    if file.expires_unix > 0 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        if now > file.expires_unix {
            return Ok(LicenseView {
                entitlement: Entitlement::Free,
                expires_unix: Some(file.expires_unix),
                source: "file",
                error: Some("license expired".into()),
            });
        }
    }
    Ok(LicenseView {
        entitlement: Entitlement::Pro,
        expires_unix: if file.expires_unix > 0 {
            Some(file.expires_unix)
        } else {
            None
        },
        source: "file",
        error: None,
    })
}

pub fn message_bytes(file: &LicenseFile) -> String {
    let seat = file.seat.as_deref().unwrap_or("");
    format!(
        "v{}|{}|{}|{}|{}",
        file.version, file.product, file.tier, file.expires_unix, seat
    )
}

pub fn sign_license(file: &mut LicenseFile, signing: &SigningKey) {
    let sig = signing.sign(message_bytes(file).as_bytes());
    file.sig = hex::encode(sig.to_bytes());
}

pub fn embedded_verifying_key() -> Result<VerifyingKey, AppError> {
    #[cfg(any(test, debug_assertions))]
    {
        return Ok(dev_signing_key().verifying_key());
    }
    #[cfg(not(any(test, debug_assertions)))]
    {
        parse_verifying_key(EMBEDDED_VERIFYING_KEY_HEX)
    }
}

fn parse_verifying_key(hex_key: &str) -> Result<VerifyingKey, AppError> {
    let bytes = hex::decode(hex_key.trim())
        .map_err(|_| AppError::License("embedded license key is not hex".into()))?;
    VerifyingKey::from_bytes(
        bytes
            .as_slice()
            .try_into()
            .map_err(|_| AppError::License("embedded license key must be 32 bytes".into()))?,
    )
    .map_err(|_| AppError::License("embedded license key is invalid".into()))
}

#[cfg(any(test, debug_assertions))]
fn dev_signing_key() -> SigningKey {
    SigningKey::from_bytes(&DEV_SEED)
}

#[cfg(any(test, debug_assertions))]
pub fn issue_signed_license(expires_unix: i64, seat: Option<String>) -> LicenseFile {
    let mut file = LicenseFile {
        version: 1,
        product: "video-rs".into(),
        tier: "pro".into(),
        expires_unix,
        seat,
        sig: String::new(),
    };
    sign_license(&mut file, &dev_signing_key());
    file
}

#[cfg(test)]
mod tests {
    use super::*;

    fn future() -> i64 {
        4_000_000_000
    }

    #[test]
    fn valid_pro_license_verifies() {
        let file = issue_signed_license(future(), None);
        let view = verify_license(&file, &dev_signing_key().verifying_key()).unwrap();
        assert_eq!(view.entitlement, Entitlement::Pro);
        assert_eq!(view.expires_unix, Some(future()));
    }

    #[test]
    fn tampered_tier_fails_signature() {
        let mut file = issue_signed_license(future(), None);
        file.tier = "free".into();
        let err = verify_license(&file, &dev_signing_key().verifying_key()).unwrap_err();
        assert!(err.to_string().to_lowercase().contains("signature"));
    }

    #[test]
    fn expired_pro_becomes_free() {
        let file = issue_signed_license(1, None);
        let view = verify_license(&file, &dev_signing_key().verifying_key()).unwrap();
        assert_eq!(view.entitlement, Entitlement::Free);
        assert_eq!(view.error.as_deref(), Some("license expired"));
    }

    #[test]
    fn require_pro_rejects_free() {
        let view = LicenseView {
            entitlement: Entitlement::Free,
            expires_unix: None,
            source: "none",
            error: None,
        };
        let err = require_pro(&view).unwrap_err();
        assert!(err.to_string().contains("Pro license"));
    }

    #[test]
    fn missing_file_is_pro_in_debug() {
        let view = entitlement_from_env_and_file(None);
        assert_eq!(view.entitlement, Entitlement::Pro);
        assert_eq!(view.source, "debug_default");
    }

    #[test]
    fn force_tier_parser_in_debug() {
        assert_eq!(
            debug_force_tier_from(Some("free")),
            Some(Entitlement::Free)
        );
        assert_eq!(debug_force_tier_from(Some("PRO")), Some(Entitlement::Pro));
        assert_eq!(debug_force_tier_from(Some("nope")), None);
    }
}
