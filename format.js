export const DEFAULT_COLOR_THRESHOLDS = Object.freeze([
    Object.freeze({value: 0, color: '#e01b24'}),
    Object.freeze({value: 50, color: '#f6d32d'}),
    Object.freeze({value: 100, color: '#2ec27e'}),
]);

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function valueAtPath(attributes, path) {
    if (!path)
        return undefined;

    return path.split('.').reduce((value, part) => {
        if (value === null || value === undefined || typeof value !== 'object')
            return undefined;
        return value[part];
    }, attributes);
}

export function numericValue(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.trim() === '')
        return null;

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function parseColorThresholds(serialized) {
    let thresholds;
    try {
        thresholds = JSON.parse(serialized);
    } catch (_error) {
        return [];
    }

    if (!Array.isArray(thresholds))
        return [];

    return thresholds.flatMap(threshold => {
        const value = numericValue(threshold?.value);
        const color = threshold?.color;
        if (value === null || typeof color !== 'string' ||
            !HEX_COLOR_PATTERN.test(color))
            return [];
        return [{value, color: color.toLowerCase()}];
    });
}

export function colorForValue(value, thresholds) {
    const number = numericValue(value);
    if (number === null)
        return null;

    const sorted = [...thresholds]
        .filter(threshold => numericValue(threshold?.value) !== null &&
            typeof threshold?.color === 'string' &&
            HEX_COLOR_PATTERN.test(threshold.color))
        .sort((left, right) =>
            numericValue(left.value) - numericValue(right.value));
    if (sorted.length === 0)
        return null;

    let color = sorted[0].color.toLowerCase();
    for (const threshold of sorted) {
        if (number < numericValue(threshold.value))
            break;
        color = threshold.color.toLowerCase();
    }
    return color;
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
