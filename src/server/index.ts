import * as cors from 'cors';
import { initialCwd } from '../cli';
import * as path from 'path';
import { ProgramChoices } from '../types';
import { DiffObject } from '../diff-assessment-web';
import routes from './routes';
import { devPort, serverPort } from './config';
import * as readline from 'readline';

const express = require('express');

const enableSpaceToOpen = async () => {
    const webInterfacePort = process.env.NODE_ENV === 'development' ? devPort : serverPort;
	
	console.log(`Press SPACE to open`);

    const rl = readline.createInterface({
        input: process.stdin,
    });

	let answer;

	while (true) {
        answer = await new Promise(resolve => {
			// Enable raw mode to get individual keypresses
			readline.emitKeypressEvents(process.stdin);
			if (process.stdin.isTTY) process.stdin.setRawMode(true);

			process.stdin.on('keypress', (str, key) => {
				if (key.name === 'space') {
					resolve('web');
				}

				if (key.ctrl && key.name === 'c') {
					process.exit();
				}
			});
		});
		
		if (answer === 'web') {
			break;
		}
	}

	if (process.stdin.isTTY) process.stdin.setRawMode(false);
	rl.close();

	if (answer === 'web') {
        import('open').then((module) => {
            const port = process.env.NODE_ENV === 'development' ? devPort : serverPort;
            module(`http://localhost:${port}`);
        });
		return;
	}
}

const startServer = (programChoices: ProgramChoices, diffFiles?: DiffObject[]) => {

    const app = express();

    // Middleware to pass programChoices and diffFiles to all routes
    app.use((req: any, res: any, next: any) => {
        req.programChoices = programChoices;
        req.diffFiles = diffFiles;
        req.allSuitesDir = path.join(
            programChoices?.containerized ? '/app' : initialCwd,
            '/suites'
        )
        next();
    });

    app.use(express.json());

    if (process.env.NODE_ENV === 'development') {
        app.use(cors({
            // This is used when developing (when React is being served by its dev server as opposed to being built and served by the express server)
            origin: 'http://localhost:' + devPort // React dev server port
        }));

        console.log('Development mode', process.env.NODE_ENV);
    } else {
        // Serve static files
        app.use(express.static(path.join(__dirname, 'app')));
    }

    // Setup Routes
    app.use('/', routes);

    // Always return the main index.html, so react-router render the route in the client
    app.get('*', (req: any, res: any) => {
        res.sendFile(path.resolve(__dirname, 'app', 'index.html'));
    });

    // Error Handler
    app.use(function (err: any, req: any, res: any, next: any) {
        res.send({
            error: true,
            errorCode: err.errorCode,
            errorMessage: err.errorMessage,
        });
    });

    
    app.listen(serverPort, () => {
        const webInterfacePort = process.env.NODE_ENV === 'development' ? devPort : serverPort;
        // execSync('ls -la', { stdio: 'inherit' });
        console.log(`Web interface is running at http://localhost:${webInterfacePort}`);

        enableSpaceToOpen();
    });
}

export default startServer;

