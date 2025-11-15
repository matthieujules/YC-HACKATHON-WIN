const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const PEOPLE_FILE = path.join(DATA_DIR, 'people.json');

class JSONStorage {
  constructor() {
    this.ensureDataFile();
  }

  ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PEOPLE_FILE)) {
      fs.writeFileSync(PEOPLE_FILE, JSON.stringify({ people: [] }, null, 2));
    }
  }

  readPeople() {
    try {
      const data = fs.readFileSync(PEOPLE_FILE, 'utf8');
      return JSON.parse(data).people || [];
    } catch (error) {
      console.error('Error reading people file:', error);
      return [];
    }
  }

  writePeople(people) {
    try {
      fs.writeFileSync(PEOPLE_FILE, JSON.stringify({ people }, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing people file:', error);
      return false;
    }
  }

  async createPerson(name, walletAddress, photos) {
    const people = this.readPeople();

    const newPerson = {
      id: uuidv4(),
      name,
      wallet: walletAddress,
      photos,
      photoCount: photos.length,
      createdAt: new Date().toISOString()
    };

    people.push(newPerson);
    this.writePeople(people);

    return newPerson;
  }

  async getAllPeople() {
    return this.readPeople();
  }

  async deletePerson(id) {
    const people = this.readPeople();
    const filtered = people.filter(p => p.id !== id);

    if (filtered.length === people.length) {
      return false; // Person not found
    }

    this.writePeople(filtered);
    return true;
  }

  async getPersonById(id) {
    const people = this.readPeople();
    return people.find(p => p.id === id);
  }
}

module.exports = new JSONStorage();
