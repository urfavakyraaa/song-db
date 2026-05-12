const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

const PROJECT_DIR = process.cwd(); 
const OUTPUT_DIR = path.join(PROJECT_DIR);
const INPUT_FILE = '/sdcard/Download/song.txt'; 
const DATABASE_FILE = path.join(PROJECT_DIR, 'SongData.json');
const GAME_DB_FILE = path.join(PROJECT_DIR, 'TebakLagu.json');

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/urfavakyraaa/song-db/main/';

const showBanner = () => {
    console.log(`\n${colors.magenta}==========================================${colors.reset}`);
    console.log(`${colors.cyan}         SCRIPT AUTO-SYNC GITHUB`);
    console.log(`    Run > Download > Sync > Auto-Push${colors.reset}`);
    console.log(`${colors.magenta}==========================================${colors.reset}\n`);
};

const runCommand = (cmd) => {
    try {
        console.log(`${colors.magenta}[SHELL] Executing: ${cmd}${colors.reset}`);
        execSync(cmd, { stdio: 'inherit' });
        return true;
    } catch (e) {
        console.error(`${colors.red}[!] Shell Error: ${e.message}${colors.reset}`);
        return false;
    }
};

const processAudio = (previewUrl, fileName) => {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(OUTPUT_DIR, fileName);
        const cmd = `ffmpeg -i "${previewUrl}" -t 8 -af "afade=t=in:ss=0:d=1,afade=t=out:st=6.5:d=1.5" -y "${outputPath}"`;
        const { exec } = require('child_process');
        exec(cmd, (error) => error ? reject(error) : resolve(outputPath));
    });
};

const main = async () => {
    showBanner();
    
    let finalJson = [];
    let successCount = 0;
    let isChanged = false;
 
    if (fs.existsSync(DATABASE_FILE)) {
        finalJson = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'));
        if (finalJson.length > 0) successCount = Math.max(...finalJson.map(item => item.id));
    }

    if (fs.existsSync(INPUT_FILE)) {
        const songs = fs.readFileSync(INPUT_FILE, 'utf-8').split('\n').filter(line => line.trim() !== '');
        
        for (let query of songs) {
            query = query.trim();
            if (finalJson.some(item => item.original_query === query)) continue; 

            console.log(`${colors.cyan}[↻] Searching & Downloading: "${query}"...${colors.reset}`);
            try {
                const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`);
                const data = await res.json();

                if (data.data?.length > 0) {
                    const track = data.data[0];
                    if (track.preview) {
                        successCount++;
                        const fileName = `AUD_${successCount}.mp3`;
                        await processAudio(track.preview, fileName);
                        
                        finalJson.push({
                            id: successCount,
                            file: fileName,
                            title: track.title,
                            artist: track.artist.name,
                            deezer_url: track.link,
                            original_query: query
                        });
                        isChanged = true;
                        console.log(`${colors.green}[✓] Saved: ${fileName}${colors.reset}\n`);
                    }
                }
            } catch (err) { console.error(`${colors.red}[!] Skip "${query}": ${err.message}${colors.reset}\n`); }
        }
        if (isChanged) fs.writeFileSync(DATABASE_FILE, JSON.stringify(finalJson, null, 2));
    }

    const gameDatabase = finalJson.map((item, index) => ({
        index: index,
        link: `${GITHUB_RAW_BASE}${item.file}`,
        answer: `${item.title} - ${item.artist}`
    }));

    if (!fs.existsSync(GAME_DB_FILE) || JSON.parse(fs.readFileSync(GAME_DB_FILE, 'utf-8')).length !== gameDatabase.length) {
        fs.writeFileSync(GAME_DB_FILE, JSON.stringify(gameDatabase, null, 2));
        isChanged = true;
        console.log(`${colors.green}[✓] TebakLagu.json updated!${colors.reset}`);
    }

    if (isChanged) {
        console.log(`\n${colors.cyan}[>] Memulai Proses Auto-Push ke GitHub...${colors.reset}`);
        runCommand('git add .');
        runCommand(`git commit -m "Auto-update assets: Total ${finalJson.length} songs"`);
        runCommand('git push origin main');
        console.log(`\n${colors.green}[✓] SEMUANYA SINKRON KE GITHUB! GOKIL!${colors.reset}\n`);
    } else {
        console.log(`\n${colors.yellow}[•] Tidak ada perubahan data. Skip auto-push.${colors.reset}\n`);
    }
};

main();
