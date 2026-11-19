"""把本地摄像头关键点转成飞船位置和牵引开关。"""
from dataclasses import dataclass
from math import hypot
from pathlib import Path
from threading import Event, Thread
from time import monotonic


@dataclass(frozen=True)
class Sample:
    """后台线程发布的单帧快照。主线程只读，不会修改帧内容。"""
    time: float = 0.0
    image: bytes = b''
    points: tuple = ()


class Gestures:
    def __init__(self):
        self.reset()

    def reset(self):
        self.position = None
        self.pressed = self.candidate = False
        self.since = self.previous = None

    def update(self, sample, now):
        """用掌心估算位置，用拇指与食指的相对距离判定光束开关。"""
        # 超时帧和未检出手必须释放光束，不能重复使用上一帧的捏合。
        if now - sample.time > .28 or len(sample.points) != 21:
            self.reset()
            return None, False
        if sample.time == self.previous:
            return self.position, self.pressed
        points = sample.points
        palm = (0, 5, 9, 13, 17)
        x, y = (sum(points[i][axis] for i in palm) / len(palm) for axis in (0, 1))
        # 识别和预览同时镜像。掌心右移对应飞船右移。
        target = tuple(max(0, min(1, (value - .18) / .64)) for value in (x, y))
        if self.position is None:
            self.position = target
        else:
            # 每帧只校正三分之一，过滤摄像头的细微坐标抖动。
            self.position = tuple(a + .33 * (b - a) for a, b in zip(self.position, target))

        def distance(a, b):
            return hypot((points[a][0] - points[b][0]) * 4 / 3, points[a][1] - points[b][1])

        scale = max(distance(5, 17), distance(0, 9) * .75)
        if scale < .045:
            self.reset()
            return None, False
        # 用掌宽归一化两指距离。闭合和释放使用不同阈值，再要求持续 0.12 秒。
        candidate = distance(4, 8) / scale < (.39 if self.pressed else .27)
        if candidate != self.candidate or self.since is None:
            self.candidate, self.since = candidate, sample.time
        if sample.time - self.since >= .12:
            self.pressed = candidate
        self.previous = sample.time
        return self.position, self.pressed


class Webcam:
    preview_size = (144, 108)

    def __init__(self):
        self.sample = Sample()
        self.status = 'MOUSE MODE'
        self.error = ''
        self.thread = None
        self.stop_signal = Event()

    def start(self):
        if self.thread and self.thread.is_alive():
            return False
        self.stop_signal = Event()
        self.sample = Sample()
        self.error = ''
        self.status = 'OPENING CAMERA...'
        self.thread = Thread(target=self.read, daemon=True)
        self.thread.start()
        return True

    def stop(self):
        self.stop_signal.set()

    def read(self):
        # 摄像头读取与模型推理放在后台，避免阻塞绘制与键盘响应。
        capture = None
        try:
            import cv2
            import mediapipe as mp

            capture = cv2.VideoCapture(0)
            if not capture.isOpened():
                self.error = 'CAMERA UNAVAILABLE'
                return
            capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            model = Path(__file__).resolve().parent / 'assets' / 'hand_landmarker.task'
            vision = mp.tasks.vision
            options = vision.HandLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_buffer=model.read_bytes()),
                running_mode=vision.RunningMode.VIDEO, num_hands=1,
                min_hand_detection_confidence=.55, min_hand_presence_confidence=.55,
                min_tracking_confidence=.55)
            with vision.HandLandmarker.create_from_options(options) as tracker:
                self.status = 'SHOW ONE HAND'
                last_stamp = -1
                failures = 0
                while not self.stop_signal.is_set():
                    valid, frame = capture.read()
                    if not valid:
                        failures += 1
                        if failures >= 20:
                            self.error = 'CAMERA DISCONNECTED'
                            break
                        self.stop_signal.wait(.05)
                        continue
                    failures = 0
                    now = monotonic()
                    rgb = cv2.cvtColor(cv2.flip(cv2.resize(frame, (480, 360)), 1), cv2.COLOR_BGR2RGB)
                    last_stamp = max(last_stamp + 1, int(now * 1000))
                    result = tracker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,
                                                               data=rgb), last_stamp)
                    landmarks = tuple((p.x, p.y) for p in result.hand_landmarks[0]) if result.hand_landmarks else ()
                    preview = cv2.resize(rgb, self.preview_size)
                    self.sample = Sample(now, preview.tobytes(), landmarks)
                    self.stop_signal.wait(max(0, 1 / 24 - (monotonic() - now)))
        except ImportError:
            self.error = 'INSTALL CAMERA DEPENDENCIES'
        except Exception as error:
            self.error = 'CAMERA INITIALIZATION FAILED'
            print(f'Camera mode: {error}')
        finally:
            if capture is not None:
                capture.release()
