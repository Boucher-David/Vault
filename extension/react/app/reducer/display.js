import signup from "../../components/profile/_profile";

let defaultState = {
home: false,
signup: true,
verify: false,
unlock: false,
tile: true
}

export default (state=defaultState, action) => {
    let {type, payload} = action;
    return state;
}
