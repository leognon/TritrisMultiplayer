module.exports = {
    CLIENT_SEND_DATA: 100, //1000/10,
    SERVER_SEND_DATA: 100, //1000/1,
    CLIENT_NUM_UPDATES_BEHIND_BY: 3,
    CLIENT_MIN_BEHIND_BY: 350,
    SERVER_PHYSICS_UPDATE: 1000/60, //TODO Is physics update necessary??? Maybe only once per second in case a player cheats and doesn't send inputs
    FAKE_LATENCY: 250,
}
