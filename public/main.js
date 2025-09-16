const socket = io();
const ips = document.getElementById("inp1")
const ports = document.getElementById("inp2")
const treads = document.getElementById("inp3")
const custom = document.getElementById("custom")
const proxy_ip = document.getElementById("inp4")
const proxy_port = document.getElementById("inp5")
const autoreload = document.getElementById("reload")
const treads_to_reload = document.getElementById("inp6")
const reload_manualy = document.getElementById("reload_manual")
const start_stop = document.getElementById("start/stop")
const err = document.getElementById("error")
const all = document.getElementById("all")
const find = document.getElementById("find")
const log_text = document.getElementById("log")
const finded = document.getElementById("finded")

autoreload.checked = true;
let started = false;

function upderr(msg){
    err.innerHTML = "сервер не отвечает:"+msg
}
function updall(msg){
    all.innerHTML = "всего запросов:"+msg
}
function updfind(msg){
    find.innerHTML = "серверов найдено:"+msg
}

function mylog(msg){
    log_text.innerHTML = msg
}

custom.onclick = () =>{
    let isCustom = custom.checked
    ips.disabled = !isCustom
    ports.disabled = !isCustom
    treads.disabled = !isCustom
}
autoreload.onclick = () =>{
    let autorel = autoreload.checked
    treads_to_reload.disabled = !autorel
}

function copyText(element) {
    const text = element.textContent;

    navigator.clipboard.writeText(text)
        .then(() => {
            notification("скопировано: " + text)
        })
        .catch(err => {
            console.error("Ошибка копирования: ", err);
        });
}
function notification(text){
    const notification = document.getElementById('copyNotification');
    notification.innerHTML = text
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000); // Уведомление исчезнет через 2 секунды
}

start_stop.onclick = () =>{
    started = !started
    start_stop.innerHTML = started? "стоп" : "старт"
    socket.emit("start_or_stop",{start_stop: started,ips: ips.value,ports: ports.value,treads: treads.value,autoreload: autoreload.checked,treads_to_reload: treads_to_reload.value})
}
socket.on("start_create",() => {
    mylog("начало создания списка")
    console.log("start_create")
})
socket.on("done_create",() => {
    mylog("список создан")
    upderr(0)
    updall(0)
    updfind(0)
    console.log("done_create")
})
socket.on("upd_counter", (msg) => {
    if(msg.upd_finded && msg.data.motd_t.replace(/§./g, '') !== `{"health":true}`){
        console.log("пенiс")
        finded.innerHTML = finded.innerHTML +
            `<div class="list-item" onclick="if(event.target.tagName !== 'A'){const c=getComputedStyle(this).borderBottomColor; this.style.borderBottomColor = (c==='rgb(10, 252, 74)')?'white':'rgb(10, 252, 74)';}"><span>
            <span class="link" style="color: #eded2a" onclick="copyText(this); event.stopPropagation();">${msg.data.ip}:${msg.data.port}</span><br>
            <span style="color: #ed8c2a">${msg.data.motd_t.replace(/§./g, '')}</span><br>
            <span style="color: #00c4ff">версия: ${msg.data.version}</span><br>
            <span style="color: #51c823">игроков: ${msg.data.players_count}</span><br>
            <span style="color: #18d198"></span>
            </span></div>`
    }
    upderr(msg.errors)
    updall(msg.total)
    updfind(msg.succes)

    console.log("updated")
})

reload_manualy.onclick = () => {
    socket.emit("reload")
}

function toggleActive() {
    this.classList.toggle('active');
}

console.warn("котенко рядом")