var Q = require('q');
var keystone = require('keystone');

var Gallery = keystone.list('Gallery');
var GalleryItem = keystone.list('Gallery item');

module.exports = function(done) {
  var vesterbro = new GalleryItem.model({
    title: 'Vesterbro',
    description: 'Vesterbro er en funktionel bydel i København med 35.213 indbyggere (1. januar 2005). Tidligere var Vesterbro også en administrativ bydel, men fra 1. januar 2007 blev Vesterbro en del af den administrative bydel Vesterbro/Kongens Enghave.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Vesterbrogade-kbh02.jpg/220px-Vesterbrogade-kbh02.jpg',
    link: '/?q=vesterbro'
  }).save();

  var noerrebro = new GalleryItem.model({
    title: 'Nørrebro',
    description: 'Nørrebro er en bydel i København. Bydelen, der er et af Københavns brokvarterer, er med sine 75.714 (pr. 1. april 2012) indbyggere fordelt på 4,1 km² ikke blot den mest folkerige bydel i hovedstaden men også den mest befolkningstætte;',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Map_of_Copenhagen_with_surroundings.png/300px-Map_of_Copenhagen_with_surroundings.png',
    link: '/?q=nørrebro'
  }).save();

  var oesterbro = new GalleryItem.model({
    title: 'Østerbro',
    description: 'Østerbro er en administrativ bydel i København med 76.402 indbyggere (2016). Bydelens areal er 8,74 km2 og befolkningstætheden på 8.116 indbyggere pr. km2',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Map_of_Copenhagen_with_surroundings.png/300px-Map_of_Copenhagen_with_surroundings.png',
    link: '/?q=østerbro'
  }).save();

  var amager = new GalleryItem.model({
    title: 'Amager',
    description: 'Der bor 192.709 mennesker på Amager (1. januar 2016), og den er dermed Danmarks tættest befolkede ø. En person der er født eller er bosiddende på Amager, bliver kaldt en amager (udtales a´mager) eller (spøgende) ama´rkaner.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Amager.jpg/250px-Amager.jpg',
    link: '/?q=amager'
  }).save();

  Q.all([vesterbro, noerrebro, oesterbro, amager]).then((items) => {
    // Creating two test galleries
    var gallery1 = new Gallery.model({
      title: 'Kort og tegninger',
      description: 'Samlingen består af håndtegnede og trykte kort over København og omegn samt bygningstegninger og andre tegninger. Der er fx tegninger fra skoler, hospitaler, gadeanlæg og sporvejsdrift. Der er i alt omkring 250.000 kort og tegninger, og de dækker perioden 1167-2005.',
      order: 0,
      items: items.map((item) => { return item._id; }),
      state: 'published'
    }).save();

    var gallery2 = new Gallery.model({
      title: 'Kort og tegninger 2',
      description: 'Samlingen består af håndtegnede og trykte kort over København og omegn samt bygningstegninger og andre tegninger. Der er fx tegninger fra skoler, hospitaler, gadeanlæg og sporvejsdrift. Der er i alt omkring 250.000 kort og tegninger, og de dækker perioden 1167-2005.',
      order: 1,
      items: items.reverse().map((item) => { return item._id; }),
      state: 'published'
    }).save();

    return Q.all([gallery1, gallery2]);
  }).then(() => {
    done();
  }, console.error);
};
