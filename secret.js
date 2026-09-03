import Secret from 'gi://Secret?version=1';

export const SECRET_SCHEMA = new Secret.Schema(
    'io.github.noahbe.HomeAssistantSensorIndicator',
    Secret.SchemaFlags.NONE,
    {extension: Secret.SchemaAttributeType.STRING});

export const SECRET_ATTRIBUTES = {
    extension: 'home-assistant-sensor-indicator@noah-be.github.io',
};

export function lookupToken(cancellable, callback) {
    Secret.password_lookup(
        SECRET_SCHEMA,
        SECRET_ATTRIBUTES,
        cancellable,
        (_source, result) => {
            try {
                callback(Secret.password_lookup_finish(result), null);
            } catch (error) {
                callback(null, error);
            }
        });
}

export function storeToken(token, callback) {
    Secret.password_store(
        SECRET_SCHEMA,
        SECRET_ATTRIBUTES,
        Secret.COLLECTION_DEFAULT,
        'Home Assistant Sensor Indicator access token',
        token,
        null,
        (_source, result) => {
            try {
                callback(Secret.password_store_finish(result), null);
            } catch (error) {
                callback(false, error);
            }
        });
}

export function clearToken(callback) {
    Secret.password_clear(
        SECRET_SCHEMA,
        SECRET_ATTRIBUTES,
        null,
        (_source, result) => {
            try {
                callback(Secret.password_clear_finish(result), null);
            } catch (error) {
                callback(false, error);
            }
        });
}
