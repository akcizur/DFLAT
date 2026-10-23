const roomWidth = 3.45;
const declaredApartmentArea = 65.4;
const fixedRooms = [
  { id: "child", name: "Dětský pokoj", depth: 3.0, area: roomWidth * 3.0 },
  { id: "kitchen", name: "Kuchyně", depth: 3.5, area: roomWidth * 3.5 },
  { id: "bedroom", name: "Ložnice", depth: 4.35, area: roomWidth * 4.35 },
  { id: "living", name: "Obývací pokoj", depth: 4.65, area: roomWidth * 4.65 }
];
const fixedArea = fixedRooms.reduce((sum, room) => sum + room.area, 0);
// Reconcile the area arithmetic: 65.4 m² minus the four primary rooms is
// split evenly between the entrance hall and the B7-inspired wet core.
const supportDepth = (declaredApartmentArea - fixedArea) / (2 * roomWidth);
const rooms = [
  ...fixedRooms,
  { id: "hall", name: "Předsíň / chodba", depth: supportDepth, area: roomWidth * supportDepth },
  { id: "wet-core", name: "Koupelna + WC / jádro B7", depth: supportDepth, area: roomWidth * supportDepth }
];

export const PANELAK_LAYOUT = Object.freeze({
  system: "T06B-inspired",
  totalFloors: 4,
  basementFloors: 1,
  apartmentsPerFloor: 2,
  moduleCount: 5,
  moduleWidth: 3.6,
  totalWidth: 18.0,
  depth: 12.0,
  floorHeight: 2.8,
  exteriorWall: 0.28,
  roomWidth,
  apartmentArea: declaredApartmentArea,
  hallDepth: supportDepth,
  bathDepth: supportDepth,
  rooms,
  calculatedRoomArea: rooms.reduce((sum, room) => sum + room.area, 0),
  elevator: false,
  recessedLoggias: true,
  exteriorFinish: "weathered břízolit",
  stairGlazing: "luxfer"
});
