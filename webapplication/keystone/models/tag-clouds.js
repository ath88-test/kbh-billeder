const keystone = require('keystone');
const Types = keystone.Field.Types;

const TagCloud = new keystone.List('Tag cloud', {
    autokey: { path: 'slug', from: 'title', unique: true },
    map: { name: 'title' },
    defaultSort: 'order'
});

TagCloud.add({
    title: { type: String, required: true },
    items: { type: Types.TextArray },
    description: { type: Types.Textarea },
});

TagCloud.defaultColumns = 'title'

module.exports = TagCloud;
