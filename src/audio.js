// Web Audio feedback with no media dependencies. Silently degrades in unsupported browsers.
export class AudioDirector {
  constructor(getSettings){
    this.settings=getSettings;this.ctx=null;this.musicTick=0;this.timer=null;
  }
  context(){
    if(this.ctx)return this.ctx;
    const AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AudioContextClass)return null;
    try{this.ctx=new AudioContextClass();}catch{return null;}
    return this.ctx;
  }
  note(frequency,duration=.13,amplitude=.05,wave='sine',delay=0){
    const ctx=this.context();if(!ctx)return;
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    try{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,ctx.currentTime+delay);
      gain.gain.setValueAtTime(.0001,ctx.currentTime+delay);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001,amplitude),ctx.currentTime+delay+.02);
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+duration);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime+delay);oscillator.stop(ctx.currentTime+delay+duration+.03);
      oscillator.addEventListener('ended',()=>{oscillator.disconnect();gain.disconnect();},{once:true});
    }catch{ /* Audio is optional. */ }
  }
  cue(type='select'){
    const volume=Math.min(1,Math.max(0,Number(this.settings().sfxVolume)||0));
    if(!volume)return;
    const patterns={
      select:[440],build:[392,587],wave:[220,294,392],
      research:[392,494,659],victory:[330,440,554,660],
      defeat:[262,220,165],warning:[220,175],test:[440,554,659]
    };
    (patterns[type]||patterns.select).forEach((frequency,i)=>
      this.note(frequency,.15,.045*volume,'triangle',i*.095));
  }
  startMusic(){
    if(Number(this.settings().musicVolume)>0)this.context(); // unlock audio in the user interaction that enables music
    if(this.timer)return;
    const scale=[196,246.94,293.66,369.99,293.66,246.94,220,174.61];
    this.timer=setInterval(()=>{
      const volume=Math.min(1,Math.max(0,Number(this.settings().musicVolume)||0));
      if(!volume||globalThis.document?.hidden)return;
      const frequency=scale[this.musicTick++%scale.length];
      this.note(frequency,.48,.025*volume,'sine');
    },630);
  }
  dispose(){if(this.timer)clearInterval(this.timer);this.timer=null;this.ctx?.close().catch(()=>{});this.ctx=null;}
}
