const keystone = require('keystone');
const Types = keystone.Field.Types;

const FrontpageItem = new keystone.List('Frontpage item', {
    autokey: { path: 'slug', from: 'title', unique: true },
    map: { name: 'title' },
    defaultSort: 'order'
});

FrontpageItem.add({
    title: { type: String, required: true },
    tagCloud: { type: Types.Relationship, ref: 'Tag cloud' },
    gallery: { type: Types.Relationship, ref: 'Gallery' },
    jumbo: { type: Types.Relationship, ref: 'Jumbo item' },
    map: { type: Types.Relationship, ref: 'Map view' },
    order: { type: Types.Number, format: false },
});

FrontpageItem.defaultColumns = 'title, order'

module.exports = FrontpageItem;
