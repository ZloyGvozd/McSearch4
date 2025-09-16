const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Worker } = require('worker_threads');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const TOR_CONTROL_PORT = 9051;
const TOR_PASSWORD = 'pisun';

let list_created = false
let ips_list = []
let final_ips_list = []
let workers = []
let lasts = []
let need_to_restart=0
let autoreload=true

let currentSocket = null

//счётчики
let total = 0
let errors = 0
let succes = 0


app.use(express.static(path.join(__dirname, 'public')));

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'search.html'));
});


const torProcess = spawn("E:\\Tor\\tor\\tor.exe", ['-f', "E:\\Tor\\tor\\torrc"], {
    windowsHide: true,
    stdio: 'ignore'  // если не хочешь видеть вывод
});


torProcess.on('error', (err) => {
    console.error('Ошибка запуска tor.exe:', err);
});

torProcess.on('exit', (code) => {
    console.log('tor.exe завершился с кодом:', code);
});



io.on("connection",(socket) =>{
    socket.on("reload", () => {
        restartTor(0,true)
    })
    socket.on("start_or_stop", (state) => {
        //console.log(state)

        need_to_restart = state.treads_to_reload
        autoreload=state.autoreload

        if(state.start_stop) { //создание
            if (!list_created) {
                socket.emit("start_create")
                ips_list = create_ips_list(state.ips, state.ports)
                final_ips_list = splitIntoChunks(ips_list, parseInt(state.treads))
                socket.emit("done_create")
                for(let i=0;i<final_ips_list.length;i++){
                    let worker = new Worker('./thread.js');
                    worker.on('message', (message) => {
                        if(message.type === "stoped"){
                            lasts[message.worker_id] = message.data.last
                            //console.log(message.worker_id + ": " + message.data.last)
                        }
                        if(message.type === "closed"){
                            total++
                            socket.emit("upd_counter",{total:total,errors:errors,succes:succes,upd_finded:false,data:{}})
                            restartTor(total,false)
                        }
                        if(message.type === "undefined"){
                            total++
                            errors++
                            socket.emit("upd_counter",{total:total,errors:errors,succes:succes,upd_finded:false,data:{}})
                            restartTor(total,false)
                        }
                        if(message.type === "succes"){
                            total++
                            if(message.data.motd_t.replace(/§./g, '') !== `{"health":true}`) {
                                succes++
                                socket.emit("upd_counter", {total: total, errors: errors, succes: succes, upd_finded: true, data: message.data})
                            }
                            restartTor(total,false)
                        }
                    });
                    workers.push(worker)
                    lasts.push(0)
                }
                list_created = true
            }
            for(let i=0;i<workers.length;i++) { //запуск
                let worker = workers[i]
                worker.postMessage({type: "ips_list", data: {ips: final_ips_list[i], last: lasts[i]},worker_id:i});
            }
        }else { //остановка
            for(let i=0;i<workers.length;i++){
                workers[i].postMessage({type: "stop", data: {},worker_id:i})
            }
        }

    })
})

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function restartTor(i,manual){
    if ((i % need_to_restart === 0 && autoreload) || manual) {
        return new Promise((resolve, reject) => {
            const socket = net.connect(TOR_CONTROL_PORT, '127.0.0.1', () => {
                socket.write(`AUTHENTICATE "${TOR_PASSWORD}"\r\n`);
            });

            let stage = 0;

            socket.on('data', (data) => {
                const msg = data.toString();
                if (stage === 0 && msg.includes('250 OK')) {
                    stage = 1;
                    socket.write('SIGNAL NEWNYM\r\n');
                } else if (stage === 1 && msg.includes('250 OK')) {
                    console.log(`[${new Date().toLocaleTimeString()}] Tor IP был сменён.`);
                    socket.end();
                    resolve();
                } else if (msg.includes('515')) {
                    reject('Ошибка авторизации. Проверь пароль в torrc и в скрипте.');
                    socket.end();
                }
            });

            socket.on('error', (err) => {
                reject('Ошибка подключения к Tor: ' + err.message);
            });
        });
    }
}

//возвращает список ip+порт
function create_ips_list(ips,ports){
    ip_splited = [ips.split("-")[0].split("."),ips.split("-")[1].split(".")]
    for(let i=0;i<ip_splited.length;i++){
        for(let x=0;x<ip_splited[i].length;x++){
            ip_splited[i][x] = parseInt(ip_splited[i][x])
        }
    }

    port_splited = [parseInt(ports.split("-")[0]),parseInt(ports.split("-")[1])]

    //console.log(ip_splited)
    let out = []
    for(let n1=ip_splited[0][0];n1<ip_splited[1][0]+1;n1++){
        for(let n2=ip_splited[0][1];n2<ip_splited[1][1]+1;n2++){
            for(let n3=ip_splited[0][2];n3<ip_splited[1][2]+1;n3++){
                for(let n4=ip_splited[0][3];n4<ip_splited[1][3]+1;n4++){
                    for(let p=port_splited[0];p<port_splited[1]+1;p++){
                        ip = n1.toString() + "." + n2.toString() + "." +  n3.toString() + "." +  n4.toString() + ":" +  p.toString()
                        //console.log(ip)
                        out.push(ip)
                    }
                }
            }
        }
    }
    list_created = true
    return out
}

function splitIntoChunks(arr, chunkCount) {
    const result = [];
    const baseSize = Math.floor(arr.length / chunkCount);
    const remainder = arr.length % chunkCount;

    let i = 0;
    for (let chunk = 0; chunk < chunkCount; chunk++) {
        // Накапливаем базовый размер + остаток добавим в последний чанк
        const size = (chunk === chunkCount - 1)
            ? arr.length - i
            : baseSize;
        result.push(arr.slice(i, i + size));
        i += size;
    }

    return result;
}

server.listen(3000, () => {
    console.log('Открой: http://localhost:3000/search');
});
