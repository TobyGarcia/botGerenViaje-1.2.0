import {useEffect,useRef} from 'react';
import {listenForModalBack} from '../services/modal-navigation.js';
export function useModalBack(open,close,blocked=false,priority=30){
 const current=useRef({close,blocked});current.current={close,blocked};
 useEffect(()=>{if(!open)return;return listenForModalBack(()=>{if(!current.current.blocked)current.current.close();},{priority});},[open,priority]);
}
