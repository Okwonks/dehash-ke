const crypto = require('node:crypto');
const fs = require('node:fs');
const log = require('./log')('generate-hashes');

const hashTypes = ['sha256'];

const apiPath = 'v1/phone';
const root = `dist/${apiPath}`;

const prefLen = 4;
const prefBits = Math.pow(16, prefLen);

// List from: https://en.wikipedia.org/wiki/Telephone_numbers_in_Kenya#Mobile_operators
const prefixes = [
  '254110',
  '254111',
  '254112',
  '254113',
  '254114',
  '254115',
  '254116',
  '254117',
  '254118',
  '254119',
  '254701',
  '254702',
  '254703',
  '254704',
  '254705',
  '254706',
  '254707',
  '254708',
  '254709',
  '254710',
  '254711',
  '254712',
  '254713',
  '254714',
  '254715',
  '254716',
  '254717',
  '254718',
  '254719',
  '254720',
  '254721',
  '254722',
  '254723',
  '254724',
  '254725',
  '254726',
  '254727',
  '254728',
  '254729',
  '254740',
  '254741',
  '254742',
  '254743',
  '254745',
  '254746',
  '254748',
  '254757',
  '254758',
  '254759',
  '254768',
  '254769',
  '254790',
  '254791',
  '254792',
  '254793',
  '254794',
  '254795',
  '254796',
  '254797',
  '254798',
  '254799',
].filter((_, idx) => !process.env.DEV || idx < 2);

generateHashes()
  .then(() => log('Completed OK.'))
  .catch(err => {
    log('Failed:', err);
    process.exit(1);
  });

async function generateHashes() {
  const files = {};
  for(const hashType of hashTypes) {
    fs.mkdirSync(`${root}/${hashType}`, { recursive:true });
    files[hashType] = {};
    for(let i=0; i<prefBits; i++) {
      const prefix = hexify(i);
      files[hashType][prefix] = new Map();
      fs.writeFileSync(`${root}/${hashType}/${prefix}.json`, '{');
    }
  }

  log('Generating hashes...');
  for(const prefix of prefixes) {
    for(const hashType of hashTypes) {
      for(let i=0; i<1_000_000; ++i) {
        const num = prefix + i.toString().padStart(6, '0');
        const hash = crypto.createHash(hashType).update(num).digest('hex');
        const pref = hash.substr(0, prefLen);
        const rest = hash.substr(prefLen);

        files[hashType][pref].set(rest, num);
      }

      for(const pref in files[hashType]) {
        const ws = fs.createWriteStream(`${root}/${hashType}/${pref}.json`, { flags:'a' });
        const content = [...files[hashType][pref].entries()]
          .map(([k, v]) => {
            files[hashType][pref].delete(k);
            return `"${k}":"${v}",`;
          })
          .join('');

        await new Promise((resolve, reject) => {
          if(!ws.write(content)) {
            ws.once('drain', () => ws.write(content));
          }

          ws.end();
          ws.on('finish', () => { resolve(); });
          ws.on('error', err => { reject(err); });
        });
      }
    }
  }
  log('All hashes generated.');

  log('Finalising data files...');
  for(const hashType of hashTypes) {
    for(let i=0; i<prefBits; i++) {
      const prefix = hexify(i);
      const path = `${root}/${hashType}/${prefix}.json`;
      const data = fs.readFileSync(path, { encoding:'utf8' });
      const fd = fs.openSync(path, 'w+');

      const formatted = data.slice(0, -1) + '}';
      fs.writeSync(fd, formatted);

      fs.close(fd);
    }
  }

  log('Data files finalised.');
};

function hexify(x) {
  return x.toString(16).padStart(prefLen, '0');
}
