const ethers = require('ethers')
const fs = require('fs')
require('dotenv').config()

const CONTRACT_ADDRESS = "0xc8612f5E2C8dd4bb4a4EbC4A58A045348f2BE9F8"
let contract
let data = {
    teamData: {},
    teamOrder: [],
    totalWinningScore: 0,
    solves: [],
    endTime: 0
}
let num_hackers = 0
fs.readFile('abi.json', 'utf8', (err, abi) => {
    if (err) {
        console.log(err)
    }
    main(abi)
})

async function updateHackers() {
    let event = contract.filters.registration()

    let events = await contract.queryFilter(event);
    let interface = new ethers.utils.Interface([
        "event registration(address indexed teamAddr, string name)",
    ]);
    let hackers = events.map((event) => {
        let parsed = interface.parseLog(event)
        return parsed.args
    });
    
    for (const hacker of hackers) {
        let team = hacker[1]
        let addr = hacker[0]
        if (!data.teamData[team]) {
            data.teamData[team] = []
        }
        let found = false
        for (const hacker2 of data.teamData[team]) {
            if (addr == hacker2.hacker) {
                found = true;
                break
            }
        }
        if (!found) {
            data.teamData[team].push({
                hacker: addr,
                score: null
            })
        }
    }

}

async function updateScores() {
    for (let team of Object.keys(data.teamData)) {
        for (let hackerObj of data.teamData[team]) {
            let score = await contract.scores(hackerObj.hacker)
            hackerObj.score = Number(score)
        }
    }
}

function sortData() {
    let newData = {}
    let teamScores = []
    for (let team of Object.keys(data.teamData)) {
        data.teamData[team].sort((a,b) => {
            return b.score - a.score
        })
        teamScores.push({
            team: team,
            highestScore: data.teamData[team][0].score
        })
    }
    teamScores.sort((a,b) => {
        return b.highestScore - a.highestScore
    })
    return teamScores.map((t) => {return t.team})
}

async function updateSolves() {
    let solves = []
    let count = 0
    while (count < 24) {
        let val = (await contract.solves(count)).toNumber()
        solves.push({
            function: `f${count}`,
            solves: val
        })
        count += 1
    }
    data.solves = solves
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(abi) {
    const provider = new ethers.providers.AlchemyProvider("goerli", process.env.API_KEY)
    contract = new ethers.Contract(CONTRACT_ADDRESS,abi,provider)

    while (true) {
        
        console.log('updating hackers')
        await updateHackers()
        
        console.log('updating scores')
        await updateScores()
        
        console.log('sorting data')
        let teamOrder = sortData()
        data['teamOrder'] = teamOrder
        let totalWinningScore = 0
        for (let team of teamOrder) {
            totalWinningScore += data.teamData[team][0].score
        }
        data['totalWinningScore'] = totalWinningScore

        let startTime = (await contract.startTime()).toNumber() // secs since epoch?
        if (!startTime) {
            startTime = 1667669400
        }
        let endTime = startTime + 60*60*2
        let timeExtended = await contract.timeExtended()
        if (timeExtended) {
            endTime = startTime + 60*60*3
        }
        data.endTime = endTime

        console.log('updating solves')
        await updateSolves()
        
        console.log('writing data')
        fs.writeFile('data.json', JSON.stringify(data, null, 4), (err) => {
            if (err) {
                console.log(err)
            }
        })
        console.log('sleeping 💤')
        await sleep(10000)
    }
}