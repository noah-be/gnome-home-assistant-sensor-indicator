import assert from 'node:assert/strict';

import {buildDisplay, formatValue, renderLabel, valueAtPath} from '../format.js';

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

console.log('Formatting tests passed.');
