'use strict';

const FORMAT = 'matched-review-v1';
const object = (properties) => ({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
});
const labels = ['A', 'B', 'C', 'D'];
const criteria = ['accuracy', 'prioritization', 'actionability'];
const ranking = {
    type: 'array',
    minItems: 1,
    maxItems: 4,
    items: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { type: 'string', enum: labels },
    },
};
const REVIEW_SCHEMA = object({
    rankings: object(Object.fromEntries(criteria.map((c) => [c, ranking]))),
    reasons: object(
        Object.fromEntries(
            labels.map((label) => [
                label,
                object(
                    Object.fromEntries(
                        criteria.map((c) => [
                            c,
                            { type: 'string', minLength: 12, maxLength: 2400 },
                        ]),
                    ),
                ),
            ]),
        ),
    ),
});

module.exports = { FORMAT, REVIEW_SCHEMA };
