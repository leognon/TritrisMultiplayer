const SERVER_CONFIG = {
    SEND_DATA: 100,
    PHYSICS_UPDATE: 1000/20,
    ROOM_CODE_LENGTH: 4,
    DISCONNECT_TIMEOUT: 10 * 1000 //How long after a client is disconnected (without explicitly leaving the page) until they are removed from a room
}
export default SERVER_CONFIG;
