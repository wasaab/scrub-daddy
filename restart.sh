#!/bin/sh

update_and_sleep()
{
    git pull
    sleep 5s
}

forever stopall 
sleep 5s
if [ "$1" = "hard" ]; then
    echo performing HARD git pull
    git reset --hard HEAD
    update_and_sleep
elif [ "$1" = "up" ]; then
    echo performing standard git pull
    update_and_sleep
fi
forever start src/bot.js
