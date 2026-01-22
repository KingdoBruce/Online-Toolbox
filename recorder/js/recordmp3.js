(function (exports) {

    var MP3Recorder = function (config) {

        var recorder = this;
        config = config || {};
        config.sampleRate = config.sampleRate || 44100;
        config.bitRate = config.bitRate || 128;

        var mediaDevices = navigator.mediaDevices || {};
        var stream, context, processor, realTimeWorker, microphone;
        var mp3ReceiveSuccess, currentErrorCallback;

        // 兼容性检查
        if (!mediaDevices.getUserMedia && navigator.getUserMedia) {
            mediaDevices.getUserMedia = function (constraints) {
                return new Promise(function (resolve, reject) {
                    navigator.getUserMedia.call(navigator, constraints, resolve, reject);
                });
            };
        }

        recorder.init = function () {
            if (stream) return Promise.resolve(); // 已经初始化过

            var isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            var isFileProtocol = window.location.protocol === 'file:';

            if (!window.isSecureContext && !isLocalhost) {
                var errorMsg = '录音功能需要 HTTPS 加密连接。您当前正在通过 ' + window.location.protocol + ' 访问。';
                if (isFileProtocol) {
                    errorMsg = '由于浏览器安全策略，录音功能无法直接在本地文件 (file://) 协议下运行。请将项目部署到 HTTPS 服务器，或使用本地开发服务器 (如 Live Server, Node.js) 访问。';
                }
                log(errorMsg);
                if (config.funCancel) config.funCancel(errorMsg);
                return Promise.reject(errorMsg);
            }

            if (!mediaDevices.getUserMedia) {
                var errorMsg = '当前浏览器不支持或禁用了录音功能';
                log(errorMsg);
                if (config.funCancel) config.funCancel(errorMsg);
                return Promise.reject(errorMsg);
            }

            log('正在请求麦克风权限...');
            return mediaDevices.getUserMedia({ audio: true }).then(function (s) {
                stream = s;
                var AudioContext = window.AudioContext || window.webkitAudioContext;
                context = new AudioContext();
                microphone = context.createMediaStreamSource(stream);
                processor = context.createScriptProcessor(16384, 1, 1);

                config.sampleRate = context.sampleRate;
                processor.onaudioprocess = function (event) {
                    var array = event.inputBuffer.getChannelData(0);
                    if (realTimeWorker) {
                        realTimeWorker.postMessage({ cmd: 'encode', buf: array });
                    }
                };

                try {
                    // 在 file:// 协议下，Worker 可能会触发 SecurityError (18)
                    realTimeWorker = new Worker('js/worker-realtime.js');
                } catch (e) {
                    var workerError = isFileProtocol
                        ? '浏览器禁止在本地文件协议 (file://) 下启动录音引擎。请使用本地服务器访问。'
                        : '无法启动录音引擎 (Worker)：' + e.message;
                    // 直接调用 funCancel 并结束，不在 catch 链中抛出导致二次显示
                    if (config.funCancel) config.funCancel(workerError);
                    log(workerError);
                    return;
                }

                realTimeWorker.onmessage = function (e) {
                    switch (e.data.cmd) {
                        case 'init':
                            log('录音引擎初始化成功');
                            if (config.funOk) config.funOk();
                            break;
                        case 'end':
                            log('数据转换完成');
                            if (mp3ReceiveSuccess) {
                                mp3ReceiveSuccess(new Blob(e.data.buf, { type: 'audio/mp3' }));
                            }
                            break;
                        case 'error':
                            log('录音引擎错误：' + e.data.error);
                            if (currentErrorCallback) currentErrorCallback(e.data.error);
                            break;
                    }
                };

                realTimeWorker.postMessage({
                    cmd: 'init',
                    config: {
                        sampleRate: config.sampleRate,
                        bitRate: config.bitRate
                    }
                });
            }).catch(function (error) {
                // 如果 error 是由上面 try-catch 中 throw/return 产生的，则无需再次处理
                if (!error) return;

                var msg = error.message || error;
                var errorCode = error.code || error.name;

                if (errorCode) {
                    switch (errorCode) {
                        case 18:
                        case 'SecurityError':
                            msg = '安全错误 (18)：浏览器限制了此环境下的音视频采集。请确保在 HTTPS 或 Localhost 下运行。';
                            break;
                        case 'PERMISSION_DENIED':
                        case 'PermissionDeniedError':
                        case 'NotAllowedError':
                            msg = '用户拒绝访问麦客风，请在浏览器地址栏点击“锁头”图标重新授权。';
                            break;
                        case 'NOT_SUPPORTED_ERROR':
                        case 'NotSupportedError':
                            msg = '浏览器不支持麦客风。';
                            break;
                        case 'MANDATORY_UNSATISFIED_ERROR':
                        case 'MandatoryUnsatisfiedError':
                        case 'NotFoundError':
                            msg = '找不到麦客风设备，请检查是否已连接。';
                            break;
                        default:
                            msg = '加载失败: ' + errorCode;
                            break;
                    }
                }

                log(msg);
                if (config.funCancel) config.funCancel(msg);
            });
        };

        recorder.getMp3Blob = function (onSuccess, onError) {
            currentErrorCallback = onError;
            mp3ReceiveSuccess = onSuccess;
            if (realTimeWorker) {
                realTimeWorker.postMessage({ cmd: 'finish' });
            }
        };

        var recording = false;
        recorder.isRecording = function () { return recording; };

        recorder.start = function () {
            if (!stream) {
                recorder.init().then(function () {
                    recorder.start();
                }).catch(function (err) {
                    // init 内部已经处理了提示
                });
                return;
            }

            if (context.state === 'suspended') {
                context.resume();
            }
            if (processor && microphone) {
                microphone.connect(processor);
                processor.connect(context.destination);
                recording = true;
                log('开始录音');
            }
        }

        recorder.stop = function () {
            if (processor && microphone) {
                microphone.disconnect();
                processor.disconnect();
                recording = false;
                log('录音结束');
            }
        }

        function log(str) {
            if (config.debug) {
                console.log(str);
            }
        }
    }

    exports.MP3Recorder = MP3Recorder;
})(window);