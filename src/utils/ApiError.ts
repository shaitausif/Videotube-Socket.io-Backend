class ApiError extends Error {
//   /**
//    *
//    * @param {number} statusCode
//    * @param {string} message
//    * @param {any[]} errors
//    * @param {string} stack
//    */

    statusCode: number;
    message: string; 
    errors : { [key: string]: string }[] = []
    data : any
    success : boolean

  constructor(
    statusCode: number,
    message = "Something went wrong",
    errors: any[] = [],
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };