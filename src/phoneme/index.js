// Import SAM speech synthesis
import SamJs from "https://unpkg.com/sam-js@0.3.1/dist/samjs.esm.min.js";

// Audio context setup
const AC = window.AudioContext || window.webkitAudioContext;
const ac = new AC();
const g = ac.createGain();
g.gain.value = 0.12;
g.connect(ac.destination);

// Create reverb using Schroeder method
const mkRev = () => {
  // tiny-ish Schroeder-ish: a few combs + one allpass
  const inG = ac.createGain();
  const outG = ac.createGain();
  outG.gain.value = 0.55;

  const comb = (dt, fb) => {
    const d = ac.createDelay(1);
    d.delayTime.value = dt;
    const f = ac.createGain();
    f.gain.value = fb;
    inG.connect(d);
    d.connect(f);
    f.connect(d);
    d.connect(outG);
  };

  const ap = (dt, fb) => {
    const d = ac.createDelay(1);
    const x = ac.createGain();
    const y = ac.createGain();
    const f = ac.createGain();
    d.delayTime.value = dt;
    f.gain.value = fb;
    inG.connect(x);
    x.connect(y);
    x.connect(d);
    d.connect(f);
    f.connect(x);
    d.connect(y);
    y.connect(outG);
  };

  comb(0.0297, 0.78);
  comb(0.0371, 0.77);
  comb(0.0411, 0.76);
  comb(0.0437, 0.75);
  ap(0.005, 0.7);

  return { in: inG, out: outG };
};

const rv = mkRev();
rv.out.connect(g);

// Gong sound generator
const gong = (t) => {
  const o = ac.createOscillator();
  const m = ac.createOscillator();
  const og = ac.createGain();
  const mg = ac.createGain();

  o.type = "sine";
  m.type = "sine";
  o.frequency.setValueAtTime(180, t);
  m.frequency.setValueAtTime(300, t);
  mg.gain.setValueAtTime(220, t);
  m.connect(mg).connect(o.frequency);
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(0.9, t + 0.005);
  og.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
  o.connect(og).connect(rv.in);
  o.start(t);
  m.start(t);
  o.stop(t + 3.3);
  m.stop(t + 3.3);
};

// Phoneme sound generator (original synthetic version)
const phon = (t) => {
  // simple "phoneme-ish" formants: saw -> 3 bandpasses, envelope + pitch wobble
  const src = ac.createOscillator();
  const sg = ac.createGain();
  src.type = "sawtooth";
  const f0 = [120, 150, 180][(Math.random() * 3) | 0];
  src.frequency.setValueAtTime(f0, t);
  src.frequency.linearRampToValueAtTime(
    f0 * (1.05 + Math.random() * 0.08),
    t + 0.18
  );

  const mkBP = (freq, q, gain) => {
    const b = ac.createBiquadFilter();
    b.type = "bandpass";
    b.frequency.value = freq;
    b.Q.value = q;
    const gg = ac.createGain();
    gg.gain.value = gain;
    return { b, gg };
  };

  // pick a rough vowel set
  const V = [
    [500, 1500, 2500], // "a"
    [300, 2200, 3000], // "i"
    [400, 900, 2600], // "e"
    [350, 800, 2300], // "o"
    [250, 700, 2400], // "u"
  ][(Math.random() * 5) | 0].map((x) => x * (0.9 + Math.random() * 0.25));

  const p1 = mkBP(V[0], 10, 1.8);
  const p2 = mkBP(V[1], 12, 1.2);
  const p3 = mkBP(V[2], 14, 0.8);

  src.connect(sg);
  sg.connect(p1.b);
  sg.connect(p2.b);
  sg.connect(p3.b);
  p1.b.connect(p1.gg).connect(rv.in);
  p2.b.connect(p2.gg).connect(rv.in);
  p3.b.connect(p3.gg).connect(rv.in);

  sg.gain.setValueAtTime(0, t);
  sg.gain.linearRampToValueAtTime(1.4, t + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.0008, t + 0.45);

  src.start(t);
  src.stop(t + 0.5);
};

// Speech synthesis phoneme generator
const speechSynth = window.speechSynthesis;

// Generate random pronounceable words using SAM phonetic alphabet
const generatePhoneticWord = () => {
  // SAM phonetic alphabet organized by type
  const vowels = [
    "IY",
    "IH",
    "EH",
    "AE",
    "AA",
    "AH",
    "AO",
    "OH",
    "UH",
    "UX",
    "ER",
    "AX",
    "IX",
  ];

  const diphthongs = ["EY", "AY", "OY", "AW", "OW", "UW"];

  // Common consonants (avoiding /H, favoring common ones)
  const commonConsonants = [
    "R",
    "L",
    "W",
    "Y",
    "M",
    "N",
    "B",
    "D",
    "G",
    "Z",
    "V",
    "S",
    "F",
    "P",
    "T",
    "K",
  ];

  const specialConsonants = [
    "WH",
    "NX",
    "J",
    "ZH",
    "DH",
    "SH",
    "TH",
    "CH",
    "DX",
  ];

  // Combine consonant pools (favor common ones)
  const allConsonants = [
    ...commonConsonants,
    ...commonConsonants, // double for higher probability
    ...specialConsonants,
  ];

  const allVowelSounds = [...vowels, ...diphthongs];

  // Stress markers: 3-5 for natural, gentle stress
  const stressMarkers = ["3", "4", "5"];

  // Build a phonetic syllable: [consonant] + vowel + [stress] + [consonant]
  const buildPhoneticSyllable = (shouldStress) => {
    const patterns = ["CV", "CVC", "VC", "V", "CCV", "VCC"];
    const pattern = patterns[(Math.random() * patterns.length) | 0];
    let syllable = "";
    let vowelAdded = false;

    for (const char of pattern) {
      if (char === "C") {
        syllable += allConsonants[(Math.random() * allConsonants.length) | 0];
      } else if (char === "V") {
        const vowelSound =
          allVowelSounds[(Math.random() * allVowelSounds.length) | 0];
        syllable += vowelSound;

        // Add stress marker after the vowel (only first vowel in syllable)
        if (shouldStress && !vowelAdded) {
          syllable += stressMarkers[(Math.random() * stressMarkers.length) | 0];
        }
        vowelAdded = true;
      }
    }

    return syllable;
  };

  // Generate 1-3 syllables with proper stress distribution
  const numSyllables = 1 + ((Math.random() * 3) | 0);
  let word = "";

  for (let i = 0; i < numSyllables; i++) {
    // Primary stress on first or middle syllable
    const shouldStress =
      (i === 0 && numSyllables > 1) ||
      (i === 1 && numSyllables === 3) ||
      (numSyllables === 1 && Math.random() > 0.5);

    word += buildPhoneticSyllable(shouldStress);
  }

  return word;
};

// Generate random pronounceable words (original text mode)
const generateWord = () => {
  // Consonants and vowels for building syllables
  const consonants = [
    "b",
    "c",
    "d",
    "f",
    "g",
    "h",
    "j",
    "k",
    "l",
    "m",
    "n",
    "p",
    "r",
    "s",
    "t",
    "v",
    "w",
    "y",
    "z",
  ];
  const vowels = ["a", "e", "i", "o", "u", "ah", "ay", "ee", "oh", "oo"];

  // Common syllable patterns: CV (consonant-vowel), VC (vowel-consonant), CVC
  const patterns = ["CV", "VC", "CVC", "V"];

  const buildSyllable = () => {
    const pattern = patterns[(Math.random() * patterns.length) | 0];
    let syllable = "";

    for (const char of pattern) {
      if (char === "C") {
        syllable += consonants[(Math.random() * consonants.length) | 0];
      } else {
        syllable += vowels[(Math.random() * vowels.length) | 0];
      }
    }
    return syllable;
  };

  // Generate word until it's at least 2 characters
  let word = "";
  while (word.length < 2) {
    // Generate 1-3 syllables
    const numSyllables = (1 + Math.random() * 3) | 0;
    word = "";
    for (let i = 0; i < numSyllables; i++) {
      word += buildSyllable();
    }
  }

  return word;
};

const phonSpeech = (delay, word) => {
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0; // Very slow (0.1 = slowest, 1.0 = normal, 10 = fastest)
    utterance.pitch = 0; // Vary pitch between 0.8-1.2
    utterance.volume = 0.2; // Volume (0 to 1)

    speechSynth.speak(utterance);
  }, delay * 1000);
};

// SAM speech synthesis (retro C64 style, works with reverb!)
const phonSAM = (t, word) => {
  // Slow and deep voice parameters - pass as constructor options
  const sam = new SamJs({
    speed: 150, // Slower speech (HIGHER = slower, default is 72)
    pitch: 100, // Pitch (HIGHER = higher pitch, default is 64)
    // throat: 128, // Throat resonance
    // mouth: 128, // Mouth cavity
    phonetic: true,
  });

  // Generate audio buffer from SAM using 32-bit float (better quality)
  const buf32 = sam.buf32(word);
  //   const buf32 = sam.buf32("DAA4NX");

  // Create AudioBuffer directly from Float32Array
  const audioBuffer = ac.createBuffer(1, buf32.length, 22050); // SAM outputs at 22050 Hz
  const channelData = audioBuffer.getChannelData(0);

  // Copy the Float32Array data directly (already in correct format)
  channelData.set(buf32);

  // Create buffer source and effects chain
  const source = ac.createBufferSource();
  source.buffer = audioBuffer;

  // Low-pass filter to smooth harsh digital edges
  const lpf = ac.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 1200; // Cut highs for warmth
  lpf.Q.value = 0.8; // Gentle slope

  // Chorus effect - creates subtle pitch variations for thickness
  const chorusDelay1 = ac.createDelay(1);
  const chorusDelay2 = ac.createDelay(1);
  const chorusLFO1 = ac.createOscillator();
  const chorusLFO2 = ac.createOscillator();
  const chorusDepth1 = ac.createGain();
  const chorusDepth2 = ac.createGain();
  const chorusMix = ac.createGain();

  // Configure chorus LFOs (low frequency oscillators for pitch modulation)
  chorusLFO1.frequency.value = 0.3; // Slow modulation
  chorusLFO2.frequency.value = 0.5; // Slightly different speed
  chorusDepth1.gain.value = 0.003; // Small pitch variation
  chorusDepth2.gain.value = 0.004;
  chorusDelay1.delayTime.value = 0.015; // ~15ms base delay
  chorusDelay2.delayTime.value = 0.025; // ~25ms base delay
  chorusMix.gain.value = 0.9; // Mix level for chorus

  // Connect chorus LFOs to modulate delay times
  chorusLFO1.connect(chorusDepth1);
  chorusDepth1.connect(chorusDelay1.delayTime);
  chorusLFO2.connect(chorusDepth2);
  chorusDepth2.connect(chorusDelay2.delayTime);

  chorusLFO1.start(t);
  chorusLFO2.start(t);

  // Subtle delay for depth (not rhythmic, just spacious)
  const delay = ac.createDelay(1);
  delay.delayTime.value = 0.08; // 80ms delay
  const delayGain = ac.createGain();
  delayGain.gain.value = 0.25; // Subtle mix

  // Signal routing: source -> lowpass -> split to (dry + chorus + delay) -> reverb
  source.connect(lpf);

  // Dry path through reverb
  lpf.connect(rv.in);

  // Chorus paths (two voices for richer effect)
  lpf.connect(chorusDelay1);
  lpf.connect(chorusDelay2);
  chorusDelay1.connect(chorusMix);
  chorusDelay2.connect(chorusMix);
  chorusMix.connect(rv.in);

  // Delay path (also through reverb for cohesion)
  lpf.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(rv.in);

  source.start(t);
};

// Main loop state
let on = false;
let intervalTime = 5000; // default 12 seconds
let speechMode = "sam"; // 'sam', 'webspeech', or 'synthetic'
let wordDisplayEl = null;

function loop() {
  if (!on) return;
  const now = ac.currentTime + 0.05;
  gong(now);
  // phoneme plays at halfway between each gong
  const phonDelay = intervalTime / 2000; // convert ms to seconds

  if (speechMode === "sam") {
    const word = generatePhoneticWord(); // Use phonetic alphabet for SAM
    if (wordDisplayEl) {
      wordDisplayEl.textContent = word;
    }
    phonSAM(now + phonDelay, word);
  } else if (speechMode === "webspeech") {
    const word = generateWord(); // Use regular text for Web Speech API
    if (wordDisplayEl) {
      wordDisplayEl.textContent = word;
    }
    phonSpeech(phonDelay, word);
  } else {
    if (wordDisplayEl) {
      wordDisplayEl.textContent = "";
    }
    phon(now + phonDelay);
  }

  setTimeout(loop, intervalTime);
}

// Initialize when DOM is ready
export function init() {
  const b = document.getElementById("b");
  const intervalInput = document.getElementById("interval");
  const intervalDisplay = document.getElementById("intervalDisplay");
  const speechModeSelect = document.getElementById("speechMode");
  wordDisplayEl = document.getElementById("wordDisplay");

  // Update interval time when input changes
  intervalInput.oninput = () => {
    intervalTime = parseInt(intervalInput.value, 10);
    intervalDisplay.textContent = `${intervalTime}ms`;
  };

  // Change speech mode
  speechModeSelect.onchange = () => {
    speechMode = speechModeSelect.value;
  };

  b.onclick = async () => {
    if (!on) {
      await ac.resume();
      on = true;
      b.classList.add("playing");
      b.setAttribute("aria-label", "Stop");
      loop();
    } else {
      on = false;
      b.classList.remove("playing");
      b.setAttribute("aria-label", "Play");
    }
  };
}
