import * as Services from "@rbxts/services";

declare global {
  interface BindableEventConnection {
    Disconnect(): void;
  }
}

interface ConnectionInfo<T extends unknown[]> {
  callback: ( ...args: T ) => void;
  autoDisconnect: boolean;
}

class CBindableSignal<A extends unknown[]> {
  private _connections = new Map<string, ConnectionInfo<A>>();
  private _waitingThreads = new Array<Callback>();
  private _classname = tostring(CBindableSignal);

  constructor() { }
  
  Once( callback: ( ...args: A ) => void ): BindableEventConnection {
    const id = Services.HttpService.GenerateGUID();
    const connected_events = this._connections;

    connected_events.set( id, {callback: callback, autoDisconnect: true} );

    return {
      Disconnect() {
        connected_events.delete( id );
      },
    };
  }

  Connect( callback: ( ...args: A ) => void ): BindableEventConnection {
    const id = Services.HttpService.GenerateGUID();
    const connected_events = this._connections;

    connected_events.set( id, {callback: callback, autoDisconnect: false} );

    return {
      Disconnect() {
        connected_events.delete( id );
      },
    };
  }

  async Fire( ...headers: A ) {
    for ( const callback of this._waitingThreads )
      callback( ...headers );

    for ( const [id, info] of this._connections ) {
      task.spawn( () => info.callback( ...headers ) );

      if ( info.autoDisconnect )
        this._connections.delete( id );
    }
  }

  Wait() {
    const thread = coroutine.running();

    this._waitingThreads.push( ( ...args: A ) => {
      coroutine.resume( thread, ...args );
    } );

    return coroutine.yield( thread ) as unknown as A;
  }

  Clear() {
    this._connections.clear();
  }
}

export default CBindableSignal;
