import './libs/webaudio-controls.js';

const getBaseURL = () => {
    return new URL('.', import.meta.url);
};

const template = document.createElement("template");
template.innerHTML = /*html*/`
  <style>
  .mainBlock .btn {
    color: white;
    cursor: pointer;
    width:60px; height:60px;
  }
  
  .btn{
    border:none;
    cursor: pointer;
  }

  .btn:hover{
    opacity: 0.3;
  }

  .grid-container {
    display: grid;
    grid-template-columns: 25% auto 25%;
    padding: 10px;
  }

  .grid-item {
    border: 1px solid rgba(0, 0, 0, 0.8);
    font-size: 30px;
    text-align: center;
  }

  .loopBtn{
    background-color:green;
    border:none;
    cursor: pointer;
  }

  .loopBtn:hover{
    opacity:0.3;
  }
  
  .loopBtn.true{
    background-color:red;
  }

  .progressBar {
    flex: 1;
    position: center;
    top: 50%;
    left: 0;
    z-index: 2;
    transform: translateY(-50%);
    width: 60%;
    appearance: none;
    margin: 0;
    overflow: hidden;
    background: #2245;
    cursor: pointer;
}
.progressBar::-webkit-slider-thumb {
appearance: none;
height: 20px;
width: 0;
box-shadow: -300px 0 0 300px #ffffff38;
}

.progressBar::-moz-range-thumb {
appearance: none;
height: 20px;
width: 0;
box-shadow: -300px 0 0 300px #ffffff21;
}

.progressBar::-ms-thumb {
    appearance: none;
    height: 20px;
    width: 0;
    box-shadow: -300px 0 0 300px #ffffff21;
}
  </style>
<div class="grid-container">
<div class="grid-item" style="border: 0;"></div>
  <div class="grid-item" style="text-align:center; 
    background:url(https://i.pinimg.com/236x/95/69/fa/9569faaa6d0808b746193f9e4e92e3e9.jpg) no-repeat; 
    border-radius:25px;
    background-size: 100% 100%;" 
    class="mainBlock">
    <p style="color: white">B MultiMed</p>
    <canvas id="myCanvas" style="width:100%;height:175px"></canvas>
    <audio id="myPlayer" crossorigin></audio>
    <input id="progress" type="range" value=0 width=100% class="progressBar">
    <br>
    <webaudio-knob id="volumeKnob" 
      src="./assets/imgs/Volume.svg" 
      value=0.5 min=0 max=1 step=0.01 
      diameter="60" 
      tooltip="Volume: %s">
    </webaudio-knob>
    <button style="background:url(https://img.icons8.com/color/60/000000/undo.png) no-repeat;
    width:60px; height:60px;" id="backward10" class="btn"></button>
    <webaudio-knob id="vitesseLecture" 
      src="./assets/imgs/SimpleFlat3.png" 
      value=1 min=0.2 max=4 step=0.1 
      diameter="60" 
      tooltip="Vitesse: %s">
    </webaudio-knob>
    <button style="transform:rotate(180deg); background:url(https://img.icons8.com/color/60/000000/undo.png) no-repeat;
    width:60px; height:60px" id="forward10" class="btn"></button>
    <webaudio-knob id="balanceKnob" 
      src="./assets/imgs/balance.png" 
      value=0 min=-1 max=1 step=0.01 
      diameter="60" 
      tooltip="Balance: %s">
    </webaudio-knob>
    <br>
    <button style="background: url(https://img.icons8.com/clouds/60/000000/play.png) no-repeat;
    width:60px; height:60px" id="play" class="btn"></button>
    <button style="background:url(https://img.icons8.com/clouds/60/000000/pause.png) no-repeat;
    width:60px; height:60px" id="pause" class="btn" ></button>
    <button style="background:url(https://img.icons8.com/clouds/60/000000/stop.png) no-repeat;
    width:60px; height:60px" id="stop" class="btn" ></button>
    <br>
    <button style="background-color:lightblue;
    width:60px; height:23px" id="restart" class="btn pause" >Restart</button>
    <button class="loopBtn" style="width:60px; height:23px" id="loopBtn">Loop</button>
  </div>
  <div class="grid-item" style="border: 0;"></div>
</div>
  `;

class MyAudioPlayer extends HTMLElement {
    constructor() {
        super();
        // Récupération des attributs HTML
        //this.value = this.getAttribute("value");

        // On crée un shadow DOM
        this.attachShadow({ mode: "open" });

        console.log("URL de base du composant : " + getBaseURL())
    }

    connectedCallback() {
        // Appelée automatiquement par le browser
        // quand il insère le web component dans le DOM
        // de la page du parent..

        // On clone le template HTML/CSS (la gui du wc)
        // et on l'ajoute dans le shadow DOM
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        // fix relative URLs
        this.fixRelativeURLs();

        this.player = this.shadowRoot.querySelector("#myPlayer");
        this.player.src = this.getAttribute("src");
        this.player.loop = false;

        // récupérer le canvas
        this.canvas = this.shadowRoot.querySelector("#myCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.loopBtn = this.shadowRoot.querySelector("#loopBtn");

        // Récupération du contexte WebAudio
        this.audioCtx = new AudioContext();

        // on définit les écouteurs etc.
        this.defineListeners();

        // On construit un graphe webaudio pour capturer
        // le son du lecteur et pouvoir le traiter
        // en insérant des "noeuds" webaudio dans le graphe
        this.buildAudioGraph();

        // on démarre l'animation
        requestAnimationFrame(() => {
            this.animationLoop();
        });
    }

    buildAudioGraph() {
        let audioContext = this.audioCtx;

        let playerNode = audioContext.createMediaElementSource(this.player);

        // Create an analyser node
        this.analyserNode = audioContext.createAnalyser();
        this.pannerNode = audioContext.createStereoPanner();

        // Try changing for lower values: 512, 256, 128, 64...
        this.analyserNode.fftSize = 8192;
        this.bufferLength = this.analyserNode.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        // lecteur audio -> analyser -> haut parleurs
        playerNode.connect(this.pannerNode).connect(this.analyserNode);
        this.analyserNode.connect(audioContext.destination);
    }


animationLoop() {
    // 1 on efface le canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 2 on dessine les objets
    //this.ctx.fillRect(10+Math.random()*20, 10, 100, 100);
    // Get the analyser data
    this.analyserNode.getByteFrequencyData(this.dataArray);

    let barWidth = this.canvas.width / this.bufferLength;
    let barHeight;
    let x = 0;

    // values go from 0 to 256 and the canvas heigt is 100. Let's rescale
    // before drawing. This is the scale factor
    let heightScale = this.canvas.height / 128;

    for (let i = 0; i < this.bufferLength; i++) {
        barHeight = this.dataArray[i];

        this.ctx.fillStyle = 'rgb(255,255,255)';
        barHeight *= heightScale;
        this.ctx.fillRect(x, this.canvas.height - barHeight / 2, barWidth, barHeight / 2);

        // 2 is the number of pixels between bars
        x += barWidth + 1;
    }
    // 3 on deplace les objets

    // 4 On demande au navigateur de recommencer l'animation
    requestAnimationFrame(() => {
        this.animationLoop();
    });
}
fixRelativeURLs() {
    const elems = this.shadowRoot.querySelectorAll("webaudio-knob, webaudio-slider, webaudio-switch, img");
    elems.forEach(e => {
        const path = e.src;
        if (path.startsWith(".")) {
            e.src = getBaseURL() + path;
        }
    });
}
defineListeners() {
    this.shadowRoot.querySelector("#play").onclick = () => {
        this.player.play();
        this.audioCtx.resume();
    }

    this.shadowRoot.querySelector("#volumeKnob").addEventListener("input",(event)=>{
      this.player.volume = event.target.value;
    });

    this.shadowRoot.querySelector("#balanceKnob").addEventListener("input",(event)=>{
      this.pannerNode.pan.value = event.target.value;
    });
      
    this.shadowRoot.querySelector("#pause").onclick = () => {
        this.player.pause();
    }

    this.shadowRoot.querySelector("#loopBtn").onclick = () => {
      this.player.loop = !this.player.loop;
      if (this.player.loop == true){
        this.loopBtn.classList.add("true");
      }
      else{
        this.loopBtn.classList.remove("true");
      }
      console.log("Value"+this.player.loop);
  }

    this.shadowRoot.querySelector("#stop").onclick = () => {
      this.player.pause();
      this.player.currentTime = 0;
  }

    this.shadowRoot.querySelector("#restart").onclick = () => {
      this.player.currentTime = 0;
}

    this.shadowRoot.querySelector("#forward10").onclick = () => {
        this.player.currentTime += 10;
    }

    this.shadowRoot.querySelector("#backward10").onclick = () => {
      this.player.currentTime -= 10;
  }

    this.shadowRoot.querySelector("#vitesseLecture").oninput = (event) => {
        this.player.playbackRate = parseFloat(event.target.value);
        console.log("vitesse =  " + this.player.playbackRate);
    }

    this.shadowRoot.querySelector("#progress").onchange = (event) => {
        this.player.currentTime = parseFloat(event.target.value);
    }

    this.player.ontimeupdate = (event) => {
        let progressSlider = this.shadowRoot.querySelector("#progress");
        progressSlider.max = this.player.duration;
        progressSlider.min = 0;
        progressSlider.value = this.player.currentTime;
    }
}

    // L'API du Web Component

}

customElements.define("my-player", MyAudioPlayer);
