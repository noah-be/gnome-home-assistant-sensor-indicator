import assert from 'node:assert/strict';

import {
    buildDisplay,
    colorForValue,
    formatValue,
    numericValue,
    parseColorThresholds,
    renderLabel,
    valueAtPath,
} from '../format.js';

const entity = {
    entity_id: 'sensor.outdoor_temperature',
    state: '21.456',
    attributes: {
        friendly_name: 'Outdoor temperature',
        unit_of_measurement: '°C',
        forecast: {today: {temperature: 19.75}},
    },
};

assert.equal(valueAtPath(entity.attributes, 'forecast.today.temperature'), 19.75);
assert.equal(valueAtPath(entity.attributes, 'forecast.tomorrow.temperature'), undefined);
assert.equal(formatValue('21.456', 1), '21.5');
assert.equal(formatValue({mode: 'eco'}), '{"mode":"eco"}');
assert.equal(numericValue(42), 42);
assert.equal(numericValue(' 21.456 '), 21.456);
assert.equal(numericValue('-1.2e3'), -1200);
assert.equal(numericValue(''), null);
assert.equal(numericValue('unknown'), null);
assert.equal(numericValue(true), null);
assert.equal(numericValue(Infinity), null);
assert.equal(renderLabel('{name}: {value} {unit}', {
    name: 'Humidity', value: '45', unit: '%', entity: 'sensor.humidity',
}), 'Humidity: 45 %');

assert.deepEqual(buildDisplay(entity, {
    template: '{name}: {value} {unit}',
    decimalPlaces: 1,
}), {
    entity: 'sensor.outdoor_temperature',
    name: 'Outdoor temperature',
    unit: '°C',
    value: '21.5',
    attribute: '',
    label: 'Outdoor temperature: 21.5 °C',
    rawValue: '21.456',
});

assert.equal(buildDisplay(entity, {
    attribute: 'forecast.today.temperature',
    displayName: 'Forecast',
    template: '{name} {value}',
    decimalPlaces: 0,
}).label, 'Forecast 20');

assert.throws(
    () => buildDisplay(entity, {attribute: 'missing'}),
    /was not found/);

const thresholds = parseColorThresholds(JSON.stringify([
    {value: 100, color: '#2EC27E'},
    {value: 0, color: '#e01b24'},
    {value: 50.5, color: '#f6d32d'},
    {value: 'invalid', color: '#ffffff'},
]));
assert.deepEqual(thresholds, [
    {value: 100, color: '#2ec27e'},
    {value: 0, color: '#e01b24'},
    {value: 50.5, color: '#f6d32d'},
]);
assert.equal(colorForValue(-10, thresholds), '#e01b24');
assert.equal(colorForValue('50.5', thresholds), '#f6d32d');
assert.equal(colorForValue(99.99, thresholds), '#f6d32d');
assert.equal(colorForValue(100, thresholds), '#2ec27e');
assert.equal(colorForValue('unavailable', thresholds), null);
assert.equal(colorForValue(25, []), null);
assert.deepEqual(parseColorThresholds('not json'), []);

console.log('Formatting tests passed.');
