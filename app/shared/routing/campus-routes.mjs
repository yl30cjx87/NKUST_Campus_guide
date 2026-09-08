const campusRoutes = Object.freeze({
  "#jiangong": "建工校區",
  "#nanzih": "楠梓校區",
  "#first": "第一校區",
  "#yanchao": "燕巢校區",
  "#cijin": "旗津校區",
});

export const campusForHash = hash => Object.hasOwn(campusRoutes, hash) ? campusRoutes[hash] : undefined;
export const hashForCampus = name => Object.keys(campusRoutes).find(hash => campusRoutes[hash] === name);
