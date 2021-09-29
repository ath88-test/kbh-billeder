const keystone = require('keystone');
const Types = keystone.Field.Types;

const JumboItem = new keystone.List('Jumbo item', {
    autokey: { path: 'slug', from: 'title', unique: true },
    map: { name: 'title' },
    defaultSort: 'title'
});

JumboItem.add({
    title: { type: String, required: true },
    description1: { type: Types.Textarea },
    description2: { type: Types.Textarea },
    image: { type: Types.CloudinaryImage, autoCleanup : true },
});

JumboItem.defaultColumns = 'title';

module.exports = JumboItem;
