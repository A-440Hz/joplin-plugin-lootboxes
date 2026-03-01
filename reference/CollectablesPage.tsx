import { useMemo, useEffect, useState, useRef } from "react";
import { useCollectablesData } from "./CollectablesDataContext";
import {useSearchParams} from "react-router-dom";
import { filenameToTitle } from "./api/collectable";
import { MagnifiedMediaModal, CollectableMedia, valueToRarity, viewAllCollectables, valueToColor } from "./Collectables";
import { formatDate } from "./api/datetime";
import ascendingOrderIcon from "/sort-ascending-svgrepo-com.svg";
import descendingOrderIcon from "/sort-descending-svgrepo-com.svg";


const sortByFunctions: Map<string, (a: any, b: any) => number> = new Map([
    ["ID_ASC", sortByCollectableID],
    ["ID_DESC", sortByCollectableID_DESC],
    ["EarnedAt_ASC", sortByEarnedAt],
    ["EarnedAt_DESC", sortByEarnedAt_DESC],
]);

function sortByCollectableID(a: any, b: any): number {
    return (a.ID || a.CollectableID || 999) - (b.ID || b.CollectableID || 999);
}

function sortByCollectableID_DESC(a: any, b: any): number {
    return (b.ID || b.CollectableID || 0) - (a.ID ||a.CollectableID || 0);
}

function sortByEarnedAt(a: any, b: any): number {
    let t = Date.now();
    return (a.EarnedAt? formatDate(a.EarnedAt).valueOf() : t) - (b.EarnedAt? formatDate(b.EarnedAt).valueOf() : t);
}

function sortByEarnedAt_DESC(a: any, b: any): number {
    return (b.EarnedAt? formatDate(b.EarnedAt).valueOf() : 0) - (a.EarnedAt? formatDate(a.EarnedAt).valueOf() : 0);
}

/**
 * A React component for displaying the collectables view.
 * @component
 * @returns {JSX.Element} A React component for the collectables page.
 */
export default function CollectablesPage() {
    const { user, earned_collectables, all_collectables, error, refreshData } = useCollectablesData();

    const [showMagnified, setShowMagnified] = useState(false);
    const [selectedCollectable, setSelectedCollectable] = useState(null);
    
    // define constants used to track sorting state
    const sortFields = ["ID", "EarnedAt"];
    const sortIndex = useRef(0);
    const [sortBy, setSortBy] = useState(sortFields[sortIndex.current]);
    const cycleSortField = () => {
        sortIndex.current = (sortIndex.current + 1) % sortFields.length;
        setSortBy(sortFields[sortIndex.current]);
    }
    const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC");
    const sortByFn = useMemo(
        () => sortByFunctions.get(`${sortBy}_${sortOrder}`) || sortByCollectableID,
        [sortBy, sortOrder]
    );
    const [searchParams, setSearchParams] = useSearchParams();
    const normalized_collectables = useMemo(() => {
        return all_collectables.map((col) => {
            const earnedCollectable = earned_collectables.find((c) => c.CollectableID === col.ID);
            return earnedCollectable ? earnedCollectable : { Collectable: col, CollectableID: col.ID, Quantity: 0, EarnedAt: null };
        });
    }, [earned_collectables, all_collectables]);    

    const view = searchParams.get("view") || "viewEarned"; // "viewEarned" is the default
    const handleSetView = (newView: string) => {
        setSearchParams({ view: newView });
    }

    useEffect(() => {
        if (user) {
        refreshData();
        }
    }, [user?.UserID]);

    if (error) return <div>Error loading backend: {error}</div>;
    if ( !user || !earned_collectables || !all_collectables ) return <div className='text-center justify-self-center'>I'm on the free version</div>;

    const handleCollectableClick = (collectable: any) => {
        setSelectedCollectable(collectable);
        setShowMagnified(true);
    };

    return (
        <div className="px-8 pt-4 w-full max-w-7xl mx-auto">
            <MagnifiedMediaModal
                showMagnified={showMagnified}
                setShowMagnified={setShowMagnified}
                collectable={selectedCollectable}
            />

            <div className="flex items-center justify-center relative rounded-lg">
                {/* <span className="flex"></span> */}
                <div className="flex space-x-4 ">
                    <button
                        className={`p-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                            view === 'viewEarned'
                                ? 'bg-yellow-500 text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2'
                                : 'bg-gray-300 text-gray-500 hover:bg-yellow-400 hover:text-white cursor-pointer'
                        }`}
                        onClick={() => handleSetView('viewEarned')}
                    >
                        View Earned
                    </button>
                    <button
                        className={`p-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                            view === 'viewAll'
                                ? 'bg-yellow-500 text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2'
                                : 'bg-gray-300 text-gray-500 hover:bg-yellow-400 hover:text-white cursor-pointer'
                        }`}
                        onClick={() => handleSetView('viewAll')}
                    >
                        View All
                    </button>
                </div>
                <div className="sm:absolute flex flex-nowrap border-2 ml-3 right-0 sm:right-11 bottom-0 space-x-1 items-center bg-slate-500 py-1 rounded-lg ">
                    <div className="text-sm"> Sort by: </div>
                    <div className="text-sm justify-self-center cursor-pointer select-none sm:w-13 hover:text-yellow-400" onClick={cycleSortField}> {sortBy} </div>
                    <img src={sortOrder === "ASC" ? ascendingOrderIcon : descendingOrderIcon}
                        alt="Sort Order Icon"
                        className="w-4 h-4 inline-block ml-1 cursor-pointer hover:ring-1 hover:ring-yellow-400 rounded"
                        onClick={() => setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC")}
                    />
                </div>
            </div>

            {view === 'viewEarned' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 p-4">
                    {earned_collectables.sort(sortByFn).map((item) => (
                        <div key={item.CollectableID} className="flex flex-col items-center">
                            <div className="cursor-pointer transform transition-transform hover:scale-105 w-32 rounded-lg overflow-hidden bg-gray-100">
                                <CollectableMedia
                                    collectable={item.Collectable}
                                    onClick={() => handleCollectableClick(item.Collectable)}
                                    lootboxView={false}
                                />
                            </div>
                            <div className="text-center mt-2">
                                <p className={`text-xs font-medium ${valueToColor(item.Collectable?.Value)} truncate max-w-full`}>
                                    <strong>{filenameToTitle(item.Collectable?.Name) || 'Unknown'}</strong>
                                </p>
                                <p className={`text-xs text-gray-300 mt-0.75`}>{valueToRarity(item.Collectable?.Value)}</p>
                                <p className="text-xs text-gray-300 mt-0.5">
                                    Quantity: {item.Quantity}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {view === 'viewAll' && (
                viewAllCollectables({earned_collectables, normalized_collectables, handleCollectableClick, sortByFN: sortByFn})
            )}
        </div>
    )
}