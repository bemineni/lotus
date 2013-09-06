//									OM
/*!
 * Lotus is a simple module loader. 
 * @author Srikanth Bemineni srikanth.bemineni@gmail.com
 * 
 */

/*! Global lotus */ 
var lotus = null;

/*! Global iam */
var iam = null;

(function(global){

	"use strict";

	/*! 
	 * List of all the modules 
	 */
	var _modules={};

	/*!
	 *  loaded script which is loaded using iam but
	 *  not yet processed.
	 */
	var loadedModule;

	/*!
	 *  Unprocessed module whose script is not yet loaded.
	 */
	var unprocessedQueue = [];

	/*! 
	 * The head html element 
	 */
	var head = document.getElementsByTagName('head')[0];
	
	/*!
	 * The current processing context 
	 */
	var currentContext = null;

	/*!
	 * The lotus module configuration
	 */
	var config = {};
	
	/*!  Console to print messages  */
	var console =  window.console ? window.console : null;

	/*! Module storage structure */
	function module()
	{
		/*! If the script DOM object is loaded */
		this.loaded = false;

		/*! This module depends on */
		this.depends = {};

		/*! num dependent module loaded */
		this.num_dependents_loaded = 0; 

		/*! File name of the module or text file that is loaded */
		this.fileName = "";
		
		/*! Just keeping the reference to the callback*/
		this.callBack = null;

		/*! The instance after it is loaded */
		this.instance = null;

		/*! The class name of the module Id */ 
		this.className = "";

		/*! The text content if this is a text file */
		this.text = null;
		
		/*! The context to which this maodule is being loaded */
		this.context = null;

		/*! This variable indicates if this module's call back was
		 * initialized or not.
		 */
		this.initialized = false;
	}

    /*!
     * This is the function used to load the module. Once the dependent modules
     * are loaded, then the callback will be called. 
     * @param name The name of the module
     * @param needs The dependent modules that need to be loaded before calling
     * this module. The dependent modules will also be passed as parameters to
     * the callback
     * @param callback The callback function that needs to be called once all
     * the dependent modules are all loaded.
     */
	iam = function( name , needs , callback  )
	{

		if(!(callback instanceof Function))
		{
			LERROR('Callback was not passed to the module ' + name );
			return;
		}
		
		if(currentContext)
		{
			
			loadedModule={ depends : needs ,
						   callBack: callback,
						   className:name };
		}
		else
		{
			//This is call directly to iam after the lotus main module is 
			//loaded
			//These are temporary modules loaded to execute and done 
			var mod = new module();
			mod.loaded = true;
			mod.depends = needs;
			mod.callBack = callback;
			mod.fileName =  '_\\|/_'+(new Date()).getTime();
			mod.context = mod.className = mod.fileName;
			
			//We will add this module
			//and delete it once it is executed
			_modules[mod.className] = mod;

			//Lets load all the dependencies
			var params =  prepareDependents(mod);

			if( params.length == mod.depends.length )
			{
				mod.instance = createModule(mod,params);
				mod.initialized = true;
				//we are done with this module;
				delete _modules[mod.fileName];
			}
			else
			{
				//There are some modules that needs to be loaded
				processModules();		
			}
		}
			
	}//iam

	/*!
	 * The main lotus module. This will be called to start of the main lotus 
	 * module.If you take the graph, then this is the root node of the module 
	 * dependency. The main lotus module will have the name '_lotusmain'
	 * @param name The name of the module
     * @param needs The dependent modules that need to be loaded before calling
     * this module. The dependent modules will also be passed as parameters to
     * the callback
     * @param callBack The callback function that needs to be called once all
     * the dependent modules are all loaded.
	 */
	lotus = function( conf , needs , callBack)
	{
		if(!(callBack instanceof Function))
		{
			LERROR('Callback was not passed to the main module _lotusmain' );
			return;
		}
		
		// We will have one main lotus module.
		var mod = new module();
		mod.loaded = true;
		mod.depends = needs;
		mod.callBack = callBack;
		mod.className = "_lotusmain";
		mod.context = "_lotusmain"
		
		//We will directly add the first module
		//called using the lotus call.
		_modules[mod.className] = mod;

		//Lets load all the dependencies
		var params =  prepareDependents(mod);

		if( params.length == mod.depends.length )
		{
			mod.instance = createModule(mod,params);
			mod.initialized = true;
		}
		else
		{
			//There are some modules that needs to loaded
			processModules();		
		}
	}//lotus


	/*! 
	 * ************************************************************************
	 * Utilities 
	 * ************************************************************************
	 */

	/*!
	 * This function prepares the dependents and return the list of the 
	 * parameters that needs to be passed to the modules call back as parameters
	 * @param mod The module structures for which the parameters have to be 
	 * prepared
	 * @return paramstoPass The parameters that are need to call the mod call back. 
	 * If the parameters are not loaded, then this function will automatically
	 * add them to the unprocessedQueue and return an empty param list.
	 */
	function prepareDependents(mod)
	{
		var allloaded = true;
		var paramstoPass = [];
	
		//There are some modules which are not yet loaded
		var i =0;
		var depmod = null;
		for( ; i < mod.depends.length ; i++ )
		{
			depmod  = mod.depends[i];
			if(_modules[depmod] == null && !is_module_getting_processed(depmod))
			{
				unprocessedQueue.push({ modulesrc:depmod,
					context:mod.context });
				allloaded = false;		
			}
			else if( _modules[depmod] != null && 
					 _modules[depmod].loaded &&
					 _modules[depmod].initialized &&
					allloaded)
			{
				paramstoPass.push(_modules[depmod].instance);
			}
			else
			{
				//Dependent module dependencies are not yet loaded
				allloaded = false;
			}
		}

		if(!allloaded)
		{
			paramstoPass = [];
		}

		return paramstoPass;
		
	}//prepareDependents
	

	/*!
	 * This function checks if a specified dependent module is still being
	 * processed, that is if it is in the unprocessedQueue list
	 * @param depmod The modules that needs to be checked
	 * @return bool true if the module is getting processed else false.
	 * 
	 */
	function is_module_getting_processed(depmod)
	{
		var i=0;
		for( ; i < unprocessedQueue.length ; i++ )
		{
		     if(unprocessedQueue[i].modulesrc === depmod)
		    	 return true;
		}
		return false;
	}//is_module_getting_processed

	
	/*!
	 * This function will executes this modules by calling the call back 
	 * and passing the parameters that are needs for this module.
	 * @param mod The module whose callback needs to be called.
	 * @param params The parameters that needs to be passed to the module
	 * callback.
	 * @return Returns what ever is returned by the call back.
	 */
	function createModule(mod , params)
	{
		if(mod.callBack)
			return mod.callBack.apply(null, params);
		else
			return null;
	}//createModule
	

	/*!
	 * This function check if all the dependent modules are loaded. 
	 * @param mod The module that needs to be checked if all the dependent 
	 * modules have been loaded.
	 * @return true if all the dependent modules are loaded else false.
	 */
	function check_if_Dependent_Modules_Loaded(mod)
	{
		var allLoaded = true;
		//check if these dependent modules are loaded
		for(needs_module in mod.depends)
		{
			if(_modules.hasOwnProperty(needs_module))
			{
				module.num_dependents_loaded++;
			}
			else
			{
				allLoaded = false;
			}
		}

		return allLoaded;
	}//check_if_Dependent_Modules_Loaded

	
	/*!
	 * This function will be called once the script is completely loaded.By the
	 * time this function is called, the iam(if present) in the newly loaded 
	 * script would have already been loaded. The iam loaded module will be in
	 * the loadedModule global variable. We always process one module after 
	 * another from the unProcessedQueue.Once the load is complete we will check
	 * if this module completes the dependencies for the waiting modules in 
	 * the _module list. If the this module completes the dependency of an 
	 * waiting module, then that module will be loaded. We continue the 
	 * dependency check all the way up to the main _lotusmain module or to the
	 * root module.  
	 * @param evt The module loaded event.
	 */
	function onLoadSucess(evt)
	{
		var scriptnode = evt.currentTarget || evt.srcElement;
		scriptnode.removeEventListener('load', onLoadSucess , false);
		scriptnode.removeEventListener('onreadystatechange', onLoadSucess, false);
		scriptnode.removeEventListener('error', onLoadError , false);
		var context = scriptnode.getAttribute('data-context');
		
		if(context !== currentContext){
			LERROR("Current context " + currentContext + " is diffrent from the " +
					"module loaded context " + context );
		}
		
		var loadComplete = false;
		var mod = null;

		/*
		 * By this time iam in the module would have loaded.
		 * The loadedModule contains the initialized module.
		 * If the loadModule is empty, then script doesn't contain
		 * the iam module. 
		 */
		//Lets create a new module
		mod = new module();
		
		/*
		 * check if this loaded module's dependencies are all loaded.
		 */
		if(loadedModule)
		{
			mod.depends = loadedModule.depends;
			mod.callBack = loadedModule.callBack;
			mod.className = loadedModule.className;
		}
		else
		{
			//These are not iam modules. 
			//Ex., jQuery
			mod.depends = [];
			mod.callBack = null;
			//filename as class name
			mod.className = scriptnode.getAttribute('data-module');
		}
		mod.loaded = true;
		mod.fileName = scriptnode.getAttribute('data-module');
		mod.context = context;
		_modules[mod.fileName] = mod;
		
		//Lets check if all the dependent modules are loaded an get 
		//the params
		var params = prepareDependents(mod);
		if( params.length == mod.depends.length )
		{
			mod.instance = createModule(mod,params);
			mod.initialized = true;
			loadComplete = true;
		}
		
		currentContext = null;


		if(loadComplete)
		{
			/* 
			 * If so, then call all dependent modules which are waiting for 
			 * this to complete  
			 * Fill up the dependencies if the other modules are waiting
			 * for this module and initialize that module
			 */
			callAllDependentModules(mod.fileName);
		}

		/*
		 * We will process the next module if exists
		 */
		processModules();
	}//onLoadSucess
	
	
	/*!
	 * This function checks if the dependent modules are all loaded. If the it
	 * is then, the that module is loaded by call the call back. Once the call
	 * back is called, we call its dependent module again from the begining
	 * We go doing this until all the dependencies completed modules are loaded
	 * or until we  have completed loading all the modules up to the root level.
	 */
	function callAllDependentModules()
	{
		var i = 0;	
		var mod = null;
		var keys = getKeys(_modules);
		while ( i < keys.length )
		{
		   	mod  = _modules[keys[i]];
		   	if(mod && !mod.initialized)
		   	{
		   		var params = prepareDependents(mod);
		   		if( params.length == mod.depends.length )
				{
					mod.instance = createModule(mod,params);
					mod.initialized = true;
					//If this is an anonymous or just in execute module
					//which was initiated using iam
					if(mod.fileName.indexOf("_\\|/_") != -1 )
				    {
						//we are done with this module;
						delete _modules[mod.fileName];
						//After deleting the keys would not be the same
						//so lets repopulate the keys
						keys = getKeys(_modules);
				    }
					
					//we will reset the index to start from first
					i = 0;
					continue;
				}
		   	}
		   	i++;
		}
	}//callAllDepedendentModules

	/*!
	 * This function process the unProcessed module that are in the queue.
	 */
	function processModules()
	{
		if(unprocessedQueue.length != 0)
		{
			//We will process all the scripts one by one.
			var mod=null;
			if(unprocessedQueue.length == 1){
				mod = unprocessedQueue.pop();
			}else{
				mod = unprocessedQueue.shift();
			}
			loadModule(mod);
			loadedModule = null;
		}
	}//processModules

	
	/*!
	 * This function is called if the DOM is not able to load specified script.
	 * @params evt The failed load event
	 */
	function onLoadError(evt)
	{
		var scriptnode = evt.currentTarget || evt.srcElement;
		currentContext = null;
		if(scriptnode)
			LERROR('Failed to load ' + scriptnode.getAttribute('data-module'));
		
		//We will go ahead with the next modules; 
		processModules();
		
	}//onLoadError


	/*!
	 * The function load the specified module into the DOM.It creates new script
	 * element and adds the head of the HTML document. Once the module is loaded 
	 * the respective call backs are called based on the file load status
	 * @param The module filename that needs to be loaded.
	 */
	function loadModule( mod )
	{

		var scriptnode =  document.createElement('script');
		scriptnode.type = 'text/javascript';
		scriptnode.charset = 'utf-8';
		scriptnode.async = true;
		scriptnode.src = mod.modulesrc;
		scriptnode.addEventListener('load', onLoadSucess, false);
		scriptnode.addEventListener('onreadystatechange', onLoadSucess, false);
		scriptnode.addEventListener('error', onLoadError, false);
		//for future if we want aliases
		scriptnode.setAttribute('data-module', mod.modulesrc );
		scriptnode.setAttribute('data-context', mod.context );
		currentContext = mod.context;
		head.appendChild(scriptnode);
	}//loadModule
	
	/*!
	 * This function removes the listener attached when the script was loaded
	 * @param node The node on which the listeners have to be removed.
	 * @param func The listener functions that needs to be removed.
	 * @param name The name of the registered event
	 * @param ieName The IE event name in case of junk IE6
	 */
	function removeListener(node, func, name, ieName) {
      
        if (node.detachEvent && !isOpera) {

            if (ieName) {
                node.detachEvent(ieName, func);
            }
        } else {
            node.removeEventListener(name, func, false);
        }
    }//removeListener


	/*!
	 * This function checks if the passed object if of Function type
	 * @param it The object that needs to be checked if it is a Function
	 */
	function isFunction(it) {
		return Object.prototype.toString.call(it) === '[object Function]';
	}//isFunction

	
	/*!
	 * This object that needs to be checked it is an Array object.
	 * @param it The object the needs to checked.
	 */
	function isArray(it) {
		return Object.prototype.toString.call(it) === '[object Array]';
	}//isArray
	
	
	/*!
	 * This function gets all the direct keys owned by the object. The keys
	 * in the prototype are not returned in the function.
	 * @param obj The object for which the keys have to be returned
	 * @return Array The array of  directly owned keys of the passed object.
	 */
	function getKeys(obj)
	{
	   var keys = [];
	   for(var key in obj)
	   {
		   if (obj.hasOwnProperty(key))
			   keys.push(key);
	   }
	   return keys;
	}//getKeys
	
	
    /*!
     * This function is used to log an error message on to the console.
     * @param message The string message that needs to be logged.
     */
	function LERROR(message)
	{
		if(console)
			console.error(message);
	}//LERROR

	/*!
    * This function is used to log a warning message on to the console.
    * @param message The string message that needs to be logged.
    */
	function LWARN(message)
	{
		if(console)
			console.warn(message);
	}//LWARN

	
	/*!
	* This function is used to log a information message on to the console.
	* @param message The string message that needs to be logged.
	*/
	function LINFO(message)
	{
		if(console)
			console.info(message);
	}//LINFO
	
	/*!
	* This function is used to log message on to the console.
	* @param message The string message that needs to be logged.
	*/
	function LLOG(message)
	{
		if(console)
			console.log(message);
	}//LLOG

})(this);








