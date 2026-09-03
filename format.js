export function valueAtPath(attributes, path) {
    if (!path)
        return undefined;

    return path.split('.').reduce((value, part) => {
        if (value === null || value === undefined || typeof value !== 'object')
            return undefined;
        return value[part];
    }, attributes);
}

export function formatValue(value, decimalPlaces = -1) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return '';

    if (decimalPlaces >= 0 && value !== '' && Number.isFinite(Number(value)))
        return Number(value).toFixed(decimalPlaces);

    if (typeof value === 'object')
        return JSON.stringify(value);

    return String(value);
}

export function renderLabel(template, context) {
    const replacements = {
        '{entity}': context.entity ?? '',
        '{name}': context.name ?? '',
        '{unit}': context.unit ?? '',
        '{value}': context.value ?? '',
    };

    let label = template || '{name}: {value} {unit}';
    for (const [placeholder, value] of Object.entries(replacements))
        label = label.replaceAll(placeholder, value);

    return label.replace(/\s+/g, ' ').trim();
}

export function buildDisplay(entity, options = {}) {
    const attribute = options.attribute?.trim() ?? '';
    const rawValue = attribute
        ? valueAtPath(entity.attributes ?? {}, attribute)
        : entity.state;

    if (attribute && rawValue === undefined)
        throw new Error(`Attribute “${attribute}” was not found.`);

    const name = options.displayName?.trim() ||
        entity.attributes?.friendly_name || entity.entity_id;
    const value = formatValue(rawValue, options.decimalPlaces ?? -1);
    const unit = entity.attributes?.unit_of_measurement ?? '';
    const context = {entity: entity.entity_id, name, unit, value};

    return {
        ...context,
        attribute,
        label: renderLabel(options.template, context),
        rawValue,
    };
}
