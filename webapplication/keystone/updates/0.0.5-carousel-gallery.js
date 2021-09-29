const keystone = require('keystone');

const Gallery = keystone.list('Gallery');
const GalleryItem = keystone.list('Gallery item');

const runUpdate = async function() {
  const indreby = new GalleryItem.model({
    title: 'Indre by',
    description: 'Indre By er den inderste bydel og hjertet af København med 50.527 (pr. 1. januar 2013) indbyggere. Indre by ligger inden for søerne (Sortedams Sø, Peblinge Sø og Skt. Jørgens Sø) og havneløbet',
    image: '',
    link: '/?q=indre+by'
  });

  const christianshavn = new GalleryItem.model({
    title: 'Christianshavn',
    description: 'På dette lavvandede og sumpede område på Amagersiden over for Slotsholmen lod Christian 4. i 1617 påbegynde anlæggelsen af en ny by.',
    image: '',
    link: '/?q=christianshavn'
  });

  try {
    await [indreby.save(), christianshavn.save()];
  }
  catch(err) {
    console.log(err.message)
  }

  // Let's fetch and relate all items to our gallery.
  const allItems = await GalleryItem.model.find();

  const newGallery = await new Gallery.model({
    title: 'Bydele',
    description: 'Samlingen består af håndtegnede og trykte kort over København og omegn samt bygningstegninger og andre tegninger. Der er fx tegninger fra skoler, hospitaler, gadeanlæg og sporvejsdrift. Der er i alt omkring 250.000 kort og tegninger, og de dækker perioden 1167-2005.',
    order: 2,
    items: allItems.map(item => item._id),
    state: 'draft',
    appearance: 'carousel'
  });

  try {
    await newGallery.save();
  }
  catch(err) {
    console.log(err.message)
  }
}

module.exports = function(done) {
  runUpdate()
    .then(() => done())
    .catch(err => console.log(err.message));
}
