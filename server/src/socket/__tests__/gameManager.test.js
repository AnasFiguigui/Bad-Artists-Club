// server/src/socket/__tests__/gameManager.test.ts
// REFERENCE/DOCUMENTATION FILE - Jest needs to be installed for these tests to work
// To use this file:
// 1. npm install --save-dev jest @jest/globals @types/jest ts-jest
// 2. Configure jest in package.json or jest.config.js
// 3. Run: npm test
/**
 * This file verifies the socket event flow in the game manager.
 * It serves as both executable tests and documentation of expected behavior.
 */
// @ts-ignore - Jest types, only available when Jest is installed
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { GameManager } from '../gameManager';
import { RoomManager } from '../roomManager';
describe('GameManager Socket Events', () => {
    let io;
    let gameManager;
    let roomManager;
    let httpServer;
    // @ts-ignore
    beforeEach(() => {
        httpServer = createServer();
        io = new Server(httpServer);
        roomManager = new RoomManager();
        gameManager = new GameManager(io, roomManager);
    });
    // @ts-ignore
    afterEach(() => {
        io.close();
        httpServer.close();
    });
    describe('Room Creation and Joining', () => {
        // @ts-ignore
        it('should emit room-created event when player creates room', (done) => {
            const mockSocket = { id: 'socket1', join: jest.fn(), emit: jest.fn() };
            // Mock the socket.io broadcast
            let broadcastedRoom = null;
            io.to = jest.fn().mockReturnValue({
                emit: (event, data) => {
                    if (event === 'room-created') {
                        broadcastedRoom = data;
                    }
                },
            });
            gameManager.handleCreateRoom(mockSocket, {
                config: { theme: 'lol', rounds: 5, drawTime: 90, maxPlayers: 8 },
                username: 'TestPlayer',
            });
            // Verify room was created and broadcast
            expect(broadcastedRoom).toBeDefined();
            expect(broadcastedRoom.players[0].username).toBe('TestPlayer');
            expect(broadcastedRoom.players[0].isHost).toBe(true);
            done();
        });
        // @ts-ignore
        it('should emit room-updated event when player joins', (done) => {
            const hostSocket = { id: 'host1', join: jest.fn() };
            const joinSocket = { id: 'join1', join: jest.fn(), emit: jest.fn(), to: jest.fn() };
            // Create room first
            const roomId = gameManager.handleCreateRoom(hostSocket, {
                config: { theme: 'lol', rounds: 5, drawTime: 90, maxPlayers: 8 },
                username: 'Host',
            });
            // Mock the event emission
            let joinRoomUpdated = null;
            joinSocket.emit = jest.fn((event, data) => {
                if (event === 'room-updated') {
                    joinRoomUpdated = data;
                }
            });
            io.to = jest.fn((rid) => ({
                emit: (event, data) => {
                    if (event === 'player-joined' && rid === roomId) {
                        // Player joined event emitted to room
                    }
                },
            }));
            // Join room
            gameManager.handleJoinRoom(joinSocket, roomId, 'Joiner');
            // Verify events were emitted
            expect(joinRoomUpdated).toBeDefined();
            expect(joinRoomUpdated.players.length).toBe(2);
            done();
        });
    });
    describe('Game Flow', () => {
        // @ts-ignore
        it('should emit game-started and round-start when host starts game', (done) => {
            const hostSocket = { id: 'host1', join: jest.fn() };
            // Create and setup room
            const roomId = gameManager.handleCreateRoom(hostSocket, {
                config: { theme: 'lol', rounds: 5, drawTime: 90, maxPlayers: 8 },
                username: 'Host',
            });
            roomManager.setPlayerReady(roomId, 'host1', true);
            // Mock event emission
            let gameStarted = null;
            let roundStarted = null;
            io.to = jest.fn((rid) => ({
                emit: (event, data) => {
                    if (event === 'game-started' && rid === roomId) {
                        gameStarted = data;
                    }
                },
            }));
            io.in = jest.fn((rid) => ({
                emit: (event, data) => {
                    if (event === 'round-start' && rid === roomId) {
                        roundStarted = data;
                    }
                },
            }));
            // Start game
            gameManager.handleStartGame(hostSocket, roomId);
            // Verify game started
            expect(gameStarted).toBeDefined();
            expect(gameStarted.state).toBe('playing');
            expect(roundStarted).toBeDefined();
            expect(roundStarted.drawer).toBeDefined();
            done();
        });
        // @ts-ignore
        it('should verify ready event updates player status', (done) => {
            const playerSocket = { id: 'player1', join: jest.fn() };
            const roomId = gameManager.handleCreateRoom(playerSocket, {
                config: { theme: 'lol', rounds: 5, drawTime: 90, maxPlayers: 8 },
                username: 'Player',
            });
            let readyBroadcast = null;
            io.to = jest.fn((rid) => ({
                emit: (event, data) => {
                    if (event === 'player-ready' && rid === roomId) {
                        readyBroadcast = data;
                    }
                },
            }));
            // Set player ready
            gameManager.handleReady(playerSocket, roomId);
            // Verify ready status
            expect(readyBroadcast).toBeDefined();
            expect(readyBroadcast.players[0].ready).toBe(true);
            done();
        });
    });
});
/**
 * Manual Testing Instructions:
 *
 * 1. Run Backend:
 *    cd server
 *    npm install --save-dev jest @jest/globals @types/jest ts-jest
 *    npm test -- socket/__tests__/gameManager.test.ts
 *
 * 2. Integration Test (Manual):
 *    - Open http://localhost:3000 in Browser 1
 *    - Create room as Player1
 *    - Copy invite link
 *    - Open link in Browser 2
 *    - Join as Player2
 *    - Check browser consoles for [Room] and [Game] prefixed logs
 *    - Both ready, start game
 *    - Game should load with drawer selected
 *
 * Expected Outcome:
 * ✓ Room created and broadcast
 * ✓ Player joined and room updated
 * ✓ Game started with drawer selected
 * ✓ Ready status updates broadcasted
 * ✓ Both players see game loading and transition to game page
 */
