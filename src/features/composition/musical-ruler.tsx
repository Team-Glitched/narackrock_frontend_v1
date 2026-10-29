import { studioStyles } from "@/styles/studio.styles";
import {musicalGridBackground,rulerLabels,type TimeSignature} from "./time-signature";
export function MusicalRuler({signature,width}:{signature:TimeSignature;width:number}) {
  return <div className={studioStyles.musicalRulerMarks} aria-hidden="true" style={{backgroundImage:musicalGridBackground(signature,{bar:"var(--muted)",beat:"var(--grid-bar)",cell:"var(--grid-beat)"})}}>{rulerLabels(signature,width).map(label=><span key={label.bar} style={{left:label.left}}>{label.bar}</span>)}</div>;
}
