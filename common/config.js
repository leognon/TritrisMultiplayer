module.exports = {
    CLIENT_SEND_DATA: 1000/10,
    SERVER_SEND_DATA: 1000/10,
    SERVER_PHYSICS_UPDATE: 1000/60, //TODO Is physics update necessary??? Maybe only once per second in case a player cheats and doesn't send inputs
    FAKE_LATENCY: 500,
}
