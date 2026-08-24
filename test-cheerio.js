const cheerio = require('cheerio');
const xml = `
<item>
<nyaa:seeders>8</nyaa:seeders>
<nyaa:infoHash>d3313cc10d89f90862f2cabe5b3fbf21b887d110</nyaa:infoHash>
<nyaa:size>435.6 MiB</nyaa:size>
</item>`;
const $ = cheerio.load(xml, { xmlMode: true });
const el = $('item');
console.log('Seeders:', $(el).find('nyaa\\:seeders').text());
console.log('Size:', $(el).find('nyaa\\:size').text());
