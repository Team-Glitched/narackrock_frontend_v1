export type NavigationFrame<T>={version:1;key:string;data:T;depth:number};
export type HistoryPort={state:unknown;replaceState:(state:unknown,title:string)=>void;pushState:(state:unknown,title:string)=>void};
const marker="narackrockNavigation";
/** Keep routing framework state and push only screen changes, not keystrokes. */
export class NavigationHistory<T>{
  private key:string|null=null;
  private expected:string|null=null;
  private depth=0;
  private replacePending=false;
  replaceNext(){this.replacePending=true;}
  canGoBack(){return this.depth>0;}
  private port:HistoryPort;
  private valid:(data:unknown)=>data is T;
  constructor(port:HistoryPort,valid:(data:unknown)=>data is T){this.port=port;this.valid=valid;}
  private frame(state:unknown):NavigationFrame<T>|null{
    if(!state||typeof state!=="object")return null;
    const frame=(state as Record<string,unknown>)[marker] as NavigationFrame<unknown>|undefined;
    return frame?.version===1&&typeof frame.key==="string"&&this.valid(frame.data)?frame as NavigationFrame<T>:null;
  }
  initialize(data:T,key:string){
    const frame=this.frame(this.port.state);
    if(frame){this.key=frame.key;this.depth=Number.isSafeInteger(frame.depth)?Math.max(0,frame.depth):0;this.expected=JSON.stringify(frame.data);return frame.data;}
    this.key=key;this.write(data,key,false);return null;
  }
  restore(state:unknown){const frame=this.frame(state);if(!frame)return null;this.key=frame.key;this.depth=Number.isSafeInteger(frame.depth)?Math.max(0,frame.depth):0;this.expected=JSON.stringify(frame.data);return frame.data;}
  sync(data:T,key:string){
    if(this.expected!==null){if(this.expected!==JSON.stringify(data))return;this.expected=null;}
    this.write(data,key,!this.replacePending&&this.key!==key);this.replacePending=false;this.key=key;
  }
  private write(data:T,key:string,push:boolean){
    const previous=this.port.state&&typeof this.port.state==="object"?this.port.state:{};
    if(push)this.depth++;
    const next={...previous,[marker]:{version:1,key,data,depth:this.depth}};
    if(push)this.port.pushState(next,"");else this.port.replaceState(next,"");
  }
}
