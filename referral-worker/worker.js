import {
    initializeApp,
    cert,
    getApps
} from "firebase-admin/app";

import {
    getFirestore,
    FieldValue
} from "firebase-admin/firestore";


/* =====================================================
   CONFIGURATION
===================================================== */

const PROJECT_ID =
    "dsatechon1-c8b41";

const REWARD_ON1 =
    25;

const REWARD_XP =
    250;

const REQUIRED_STREAK =
    3;

const FALLBACK_SPONSOR_USERNAME =
    "JennyKhiss";

const FALLBACK_SPONSOR_ON1_ID =
    "ON12YBGYI9";


/* =====================================================
   FIREBASE ADMIN INITIALIZATION
===================================================== */

if(!process.env.FIREBASE_SERVICE_ACCOUNT){

    throw new Error(
        "Missing FIREBASE_SERVICE_ACCOUNT GitHub secret."
    );

}


const serviceAccount =
    JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
    );


if(getApps().length === 0){

    initializeApp({

        credential:
            cert(serviceAccount),

        projectId:
            PROJECT_ID

    });

}


const db =
    getFirestore();


/* =====================================================
   MAIN WORKER
===================================================== */

async function processReferralRewards(){

    console.log(
        "ON1 referral worker started."
    );


    console.log(
        `Checking members with streak >= ${REQUIRED_STREAK}...`
    );


    const usersSnapshot =
        await db
            .collection("users")
            .where(
                "streak",
                ">=",
                REQUIRED_STREAK
            )
            .get();


    console.log(
        `Found ${usersSnapshot.size} qualifying member record(s).`
    );


    let processed =
        0;

    let skipped =
        0;


    for(
        const newUserDoc
        of usersSnapshot.docs
    ){

        const newUser =
            newUserDoc.data();


        /* =============================================
           ALREADY REWARDED
        ============================================= */

        if(
            newUser.referralRewardProcessed === true
        ){

            skipped++;

            continue;

        }


        const referredById =
            typeof newUser.referredById === "string"
                ? newUser.referredById.trim().toUpperCase()
                : "";


        if(!referredById){

            console.log(
                `Skipping ${newUserDoc.id}: no referredById.`
            );

            skipped++;

            continue;

        }


        /* =============================================
           FIND SPONSOR
        ============================================= */

        const sponsorSnapshot =
            await db
                .collection("users")
                .where(
                    "on1Id",
                    "==",
                    referredById
                )
                .limit(1)
                .get();


        if(sponsorSnapshot.empty){

            console.log(
                `Skipping ${newUserDoc.id}: sponsor ${referredById} not found.`
            );

            skipped++;

            continue;

        }


        const sponsorDoc =
            sponsorSnapshot.docs[0];


        const sponsor =
            sponsorDoc.data();


        /* =============================================
           SAFETY CHECK
        ============================================= */

        if(
            sponsorDoc.id === newUserDoc.id
        ){

            console.log(
                `Skipping ${newUserDoc.id}: self-referral detected.`
            );

            skipped++;

            continue;

        }


        /* =============================================
           DETERMINE SPONSOR USERNAME
        ============================================= */

        const sponsorUsername =
            typeof sponsor.username === "string" &&
            sponsor.username.trim()
                ? sponsor.username.trim()
                : (
                    referredById ===
                    FALLBACK_SPONSOR_ON1_ID
                        ? FALLBACK_SPONSOR_USERNAME
                        : referredById
                );


        /* =============================================
           TRANSACTION

           This makes the reward atomic.

           Either the sponsor gets everything and
           the new member becomes processed,

           OR nothing is changed.
        ============================================= */

        const rewardTransactionId =
            `referral_${newUserDoc.id}`;


        const rewardRef =
            db
                .collection("transactions")
                .doc(rewardTransactionId);


        try{

            await db.runTransaction(
                async(transaction) => {

                    /* =================================
                       CHECK WHETHER REWARD ALREADY EXISTS
                    ================================= */

                    const existingReward =
                        await transaction.get(
                            rewardRef
                        );


                    if(existingReward.exists){

                        return;

                    }


                    /* =================================
                       RE-READ NEW MEMBER
                    ================================= */

                    const freshNewUser =
                        await transaction.get(
                            newUserDoc.ref
                        );


                    const freshData =
                        freshNewUser.data() || {};


                    if(
                        freshData
                            .referralRewardProcessed === true
                    ){

                        return;

                    }


                    if(
                        Number(
                            freshData.streak || 0
                        ) < REQUIRED_STREAK
                    ){

                        return;

                    }


                    /* =================================
                       RE-READ SPONSOR
                    ================================= */

                    const freshSponsor =
                        await transaction.get(
                            sponsorDoc.ref
                        );


                    if(!freshSponsor.exists){

                        throw new Error(
                            "Sponsor no longer exists."
                        );

                    }


                    /* =================================
                       UPDATE SPONSOR
                    ================================= */

                    transaction.update(
                        sponsorDoc.ref,
                        {

                            referralCount:
                                FieldValue.increment(1),

                            referralBonus:
                                FieldValue.increment(
                                    REWARD_ON1
                                ),

                            balance:
                                FieldValue.increment(
                                    REWARD_ON1
                                ),

                            XP:
                                FieldValue.increment(
                                    REWARD_XP
                                )

                        }
                    );


                    /* =================================
                       NORMALIZE NEW MEMBER REFERRAL
                    ================================= */

                    transaction.update(
                        newUserDoc.ref,
                        {

                            referredBy:
                                sponsorUsername,

                            referredById:
                                referredById,

                            referralRewardProcessed:
                                true

                        }
                    );


                    /* =================================
                       CREATE TRANSACTION RECORD
                    ================================= */

                    transaction.set(
                        rewardRef,
                        {

                            type:
                                "referral_reward",

                            userId:
                                sponsorDoc.id,

                            referredUserId:
                                newUserDoc.id,

                            sponsorOn1Id:
                                referredById,

                            sponsorUsername:
                                sponsorUsername,

                            rewardON1:
                                REWARD_ON1,

                            rewardXP:
                                REWARD_XP,

                            qualification:
                                "3_day_mining_streak",

                            qualificationStreak:
                                REQUIRED_STREAK,

                            createdAt:
                                FieldValue.serverTimestamp()

                        }
                    );

                }
            );


            console.log(
                `Reward processed: ${sponsorUsername} received ${REWARD_ON1} ON1 + ${REWARD_XP} XP for ${newUserDoc.id}.`
            );


            processed++;


        }catch(error){

            console.error(
                `Failed processing ${newUserDoc.id}:`,
                error.message
            );

        }

    }


    console.log(
        `Worker finished. Processed: ${processed}; skipped: ${skipped}.`
    );

}


processReferralRewards()
    .catch(
        error => {

            console.error(
                "ON1 referral worker failed:",
                error
            );

            process.exit(1);

        }
    );
