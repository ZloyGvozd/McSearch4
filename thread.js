const { parentPort } = require('worker_threads');
const { status } = require('minecraft-server-util');

let runned = false
let current_last = 0

// Получаем сообщение от main.js
parentPort.on('message',  async (data) => {
    if(data.type === "ips_list") {
        current_last = data.data.last
        runned = true
        await mainCycle(data.data.ips,current_last,data.worker_id)
    }else if(data.type === "stop"){
        runned = false
    }
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function mainCycle(ips,last,id){
    //parentPort.postMessage({type:"succes",data:{ip: "123.121.13.123",port: 14888, motd_t: "12312212", players_count: 3, version: "1.21.5",players: ["меганасрал"]}})
    for(let i=last;i<ips.length;i++){
        current_last = i;
        if(!runned){
            parentPort.postMessage({type:"stoped",data:{last:current_last},worker_id:id})
            await sleep(10)
            break
        }

        let result = await getServerInfo(ips[i].split(":")[0],parseInt(ips[i].split(":")[1]))
        parentPort.postMessage(result)

    }
}

async function getServerInfo(ip,port){
    try{
        let response = await status(ip, {
            port: port,         // необязательный, по умолчанию 25565
            timeout: 1500,       // таймаут запроса (мс)
            enableSRV: true      // учитывать SRV-записи
        })
        console.log('Сервер онлайн!');
        console.log('Описание:', response.description.descriptionText);
        console.log('Игроков онлайн:', response.onlinePlayers);
        console.log('Версия:', response.version);
        return {type:"succes",data:{ip: ip,port: port, motd_t: response.description.descriptionText, players_count: response.onlinePlayers, version: response.version,players: ["меганасрал"]}}
    }catch(e){
        if(e === undefined){
            return {type:"undefined"}
        }else {
            return {type:"closed"}
        }
    }
}


//parentPort.postMessage(result);