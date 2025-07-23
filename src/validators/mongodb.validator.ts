// using express-validator, a powerful middleware for validating and sanitizing user input in Express.js.
import { body, param } from 'express-validator'


// A common validator responsible to validate mongodb ids passed in the url's path variable
// Validates a MongoDB ObjectId (like 64b3df39b58f7a51c62167aa) passed in the URL path parameter.
export const mongoIdPathVariableValidator = (idName: any) => {  
    return [
        param(idName).notEmpty().isMongoId().withMessage(`Invalid ${idName}`)
    ]
}


// A common validator responsible to validate mongodb ids passed in the request body

export const mongoIdRequestBodyValidator = (idName: any) => {
    return [
        body(idName).notEmpty().isMongoId().withMessage(`Invalid ${idName}`)
    ]
}