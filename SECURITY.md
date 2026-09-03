# Security Policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature instead of opening a
public issue:

<https://github.com/noah-be/gnome-home-assistant-sensor-indicator/security/advisories/new>

Do not include a real Home Assistant access token, private Home Assistant URL,
public IP address, or other home-network identifiers in a report.

## Credential handling

The extension stores its long-lived access token in the GNOME keyring through
libsecret. Non-secret preferences such as the server URL and entity ID are stored
in GSettings. During a refresh, the token is sent only in the `Authorization`
header of the request to the configured Home Assistant server.

Use an HTTPS URL when Home Assistant is reached over an untrusted network. Revoke
the token in the Home Assistant profile immediately if it may have been exposed.
