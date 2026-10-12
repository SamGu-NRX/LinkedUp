/// <reference lib="dom" />
/**
 * H-05 on the real call page: a second camera the page can pick from its
 * device menu. Chromium's fake capture offers one camera, so this init
 * script adds a second videoinput to enumerateDevices and answers
 * getUserMedia for that device id with a canvas painted like the bench's
 * second camera (SECOND_CAMERA_COLOR above a frame-counter barcode). Every
 * other request goes to the real fake devices untouched.
 */
export const SECOND_CAMERA_ID = "linkedup-eval-second-camera";

/**
 * Runs in the page (context.addInitScript(secondCameraInit, arg)).
 * @param {{ deviceId: string, color: [number, number, number] }} arg
 */
export function secondCameraInit({ deviceId, color }) {
  const md = navigator.mediaDevices;
  if (!md || /** @type {any} */ (md).__secondCamera) return;
  /** @type {any} */ (md).__secondCamera = true;
  const enumerate = md.enumerateDevices.bind(md);
  const getUserMedia = md.getUserMedia.bind(md);

  md.enumerateDevices = async () => {
    const devices = await enumerate();
    const fake = {
      deviceId,
      groupId: "linkedup-eval",
      kind: /** @type {MediaDeviceKind} */ ("videoinput"),
      label: "Second camera (eval)",
      toJSON() {
        return { deviceId, groupId: "linkedup-eval", kind: "videoinput", label: "Second camera (eval)" };
      },
    };
    return [...devices, /** @type {MediaDeviceInfo} */ (/** @type {unknown} */ (fake))];
  };

  /** @param {MediaTrackConstraints | boolean | undefined} video */
  const wantsSecond = (video) => {
    if (!video || typeof video !== "object") return false;
    const id = video.deviceId;
    if (typeof id === "string") return id === deviceId;
    if (Array.isArray(id)) return id.includes(deviceId);
    const exact = id && typeof id === "object" ? /** @type {ConstrainDOMStringParameters} */ (id).exact : undefined;
    return exact === deviceId || (Array.isArray(exact) && exact.includes(deviceId));
  };

  const canvasTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    let counter = 0;
    const paint = () => {
      ctx.fillStyle = `rgb(${color.join(", ")})`;
      ctx.fillRect(0, 0, 320, 200);
      ctx.fillStyle = "rgb(235, 235, 235)";
      ctx.fillRect(0, 200, 320, 40);
      ctx.fillStyle = "rgb(20, 20, 20)";
      const bits = (counter & 4095).toString(2).padStart(12, "0");
      for (let i = 0; i < 12; i++) if (bits[i] === "1") ctx.fillRect(24 + i * 12, 200, 12, 40);
      ctx.fillRect(8, 200, 16, 40);
      ctx.fillRect(168, 200, 16, 40);
      counter++;
    };
    paint();
    const timer = setInterval(paint, 33);
    const track = canvas.captureStream(30).getVideoTracks()[0];
    const settings = track.getSettings.bind(track);
    // The page records the selected camera from the track's settings.
    Object.defineProperty(track, "getSettings", { value: () => ({ ...settings(), deviceId }) });
    const stop = track.stop.bind(track);
    Object.defineProperty(track, "stop", {
      value: () => {
        clearInterval(timer);
        stop();
      },
    });
    return track;
  };

  md.getUserMedia = async (constraints) => {
    if (!constraints || !wantsSecond(constraints.video)) return getUserMedia(constraints);
    const stream = constraints.audio ? await getUserMedia({ audio: constraints.audio }) : new MediaStream();
    stream.addTrack(canvasTrack());
    return stream;
  };
}
