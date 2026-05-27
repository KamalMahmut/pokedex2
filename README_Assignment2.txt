# Pokedex & Team Builder

## Project Description

This project is a Pokedex and team builder website. It is based on Pokémon information, and it also works like a different form of a flashcard learning website. It can also be understood as a small part of a guide website for Pokémon or card-game players.

The website is made for Pokémon fans or new players who want to check Pokémon information quickly, remember Pokémon through a guessing game, and build their own teams. Sometimes new players may not remember Pokémon names, types, or images clearly. They may also not know what kind of team can be useful in the game. This website tries to help with that problem.

Users can view the first 151 Pokémon. Each Pokémon has information such as name, ID, image, type, and description. Users can also mark Pokémon as viewed or unviewed after learning them, so they can come back and continue learning later.

The website also includes a guessing game. The user sees a Pokémon silhouette first and then guesses the Pokémon name. This makes the website more interactive than only reading information.

Another main function is the team builder. Users can create and save their own Pokémon teams. They can also view popular teams. Popular teams are based on team combinations saved by users. For example, if several users save the same group of Pokémon, that team can become a popular team.

Admin users can manage Pokémon data and view teams created by users. Normal users can build teams, view their own teams, and play the guessing game.

## Main Features

- View 151 Pokémon from the database
- Search Pokémon by name or ID
- View Pokémon details, including image, type, ID, and description
- Mark Pokémon as viewed or unviewed
- Guess Pokémon by silhouette
- Register and log in
- Different interface for admin and normal users
- Admin can add, edit, and delete Pokémon
- Normal users can build and save teams
- Users can view their own saved teams
- Admin can view users’ saved teams
- Popular teams are generated from repeated team combinations

## Technical Stack

Frontend: React, Vite, JavaScript, CSS

Backend: Node.js, Express.js, MySQL2, bcryptjs, jsonwebtoken, dotenv, cors

Database: MySQL

The frontend is used for the website interface. The backend is used for API requests, login, register, Pokémon data, team data, and admin functions. MySQL is used to store Pokémon, users, viewed status, and saved teams.

## How to Run the App

1. Import the database file in MySQL Workbench.

File path: database/pokedex_assignment2_full.sql

2. Go to the backend folder.

Command: cd backend

3. Install backend dependencies.

Command: npm install

4. Create a `.env` file in the backend folder. Use `.env.example` as the example.

Example `.env`:

PORT=3000  
DB_HOST=127.0.0.1  
DB_USER=root  
DB_PASSWORD=your_mysql_password  
DB_NAME=pokedex  
DB_PORT=3306  
JWT_SECRET=change_this_to_a_long_random_secret  

ADMIN_EMAIL=admin@pokedex.com  
ADMIN_USERNAME=admin  
ADMIN_PASSWORD=admin123  

5. Start the backend server.

Command: npm start

6. Create the admin account if needed.

Command: npm run seed:admin

Default admin account:

Email: admin@pokedex.com  
Password: admin123

7. Open another terminal and go to the frontend folder.

Command: cd frontend

8. Install frontend dependencies.

Command: npm install

9. Start the frontend.

Command: npm run dev

10. Open the website in the browser.

Frontend address: http://localhost:5173  
Backend address: http://localhost:3000

The frontend and backend need to run at the same time.

## Dependencies

This project needs Node.js, npm, MySQL, and MySQL Workbench.

The `node_modules` folders are not included because they can be installed again with `npm install`.

The real `.env` file is also not included because it contains local database settings. The `.env.example` file is included instead.

## Folder Structure

project-folder/  
├── backend/  
│   ├── server.js  
│   ├── package.json  
│   ├── package-lock.json  
│   ├── seedAdmin.js  
│   └── .env.example  
│  
├── frontend/  
│   ├── index.html  
│   ├── package.json  
│   ├── package-lock.json  
│   ├── vite.config.js  
│   └── src/  
│       ├── App.jsx  
│       ├── main.jsx  
│       └── style.css  
│  
├── database/  
│   └── pokedex_assignment2_full.sql  
│  
├── README.md  
└── .gitignore  

## Folder Explanation

`backend` contains the server code, API logic, login/register logic, database connection, and admin seed script.

`frontend` contains the React website interface. `App.jsx` has most of the page logic, `main.jsx` starts the React app, and `style.css` controls the design.

`database` contains the SQL file for creating the database and importing the Pokémon data.

`.env.example` shows the database and server settings needed to run the project locally.

`.gitignore` is used to avoid uploading files such as `node_modules` and `.env`.

## Notes

Normal users can use the Pokedex, guessing game, Team Builder, My Teams, and Popular Teams.

Admin users can manage Pokémon data and view users’ saved teams.

Popular Teams are based on the same Pokémon team combination, not the team name. If different users save the same group of Pokémon, the website counts it as the same popular team.

