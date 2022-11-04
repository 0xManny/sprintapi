const ethers = require('ethers')
const fs = require('fs')
require('dotenv').config()

let contract
let data = {
    teamData: {},
    teamOrder: [],
    totalWinningScore: 0,
    solves: {},
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
    while (true) {
        let hacker
        try {
            hacker = await contract.hackers(num_hackers)
            num_hackers += 1
        } catch (err) {
            break
        }
        let team = await contract.teams(hacker)
        if (!data.teamData[team]) {
            data.teamData[team] = []
        }
        data.teamData[team].push({
            hacker: hacker,
            score: null
        })
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
    let solves = {}
    let count = 0
    while (count < 24) {
        let val = 0 // await contract.solves(count)
        solves[`f${count}`] += val
        count += 1
    }
    data.solves = solves
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(abi) {
    const provider = new ethers.providers.AlchemyProvider("goerli", process.env.API_KEY)
    contract = new ethers.Contract(process.env.CONTRACT_ADDRESS,abi,provider)

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

        let startTime = 1667765099 // contract.startTime() // secs since epoch?
        let endTime = startTime + 60*60*2
        let timeExtended = false // await contract.timeExtended()
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