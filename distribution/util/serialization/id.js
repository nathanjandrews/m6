let idSeed = 1;

function setIdSeed(n) {
  idSeed = n;
}

function generateId() {
  return (idSeed++).toString();
}

module.exports = {
  setIdSeed,
  generateId,
};
