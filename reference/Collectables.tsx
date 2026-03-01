import { useState, useEffect } from "react";
import { useInView } from "./CollectablesDataContext";
import { getImageURL, filenameToTitle } from "./api/collectable";
import ReactPlayer from "react-player";


const rarityMap: Map<string, [string, string]> = new Map([
    ["C", ["Common", "text-green-600"]],
    ["B", ["Rare", "text-cyan-600"]],
    ["A", ["Epic", "text-purple-500"]],
    ["S", ["Legendary", "text-yellow-500"]],
]);

export function valueToRarity(v: string): string {
    // TODO: can return color and styled element
    return rarityMap.get(v)?.[0] || "Unknown";
}

export function valueToColor(v: string): string {
    // TODO: can return color and styled element
    return rarityMap.get(v)?.[1] || "Unknown";
}

/**
 * generic component to display a collectable's media (image or video)
 * @component
 * @param {collectable} collectable - the collectable to display
 * @param {function} onClick - function to handle clicking on the collectable
 * @param {boolean} lootboxView - whether the collectable is being viewed in a lootbox context 
 * @returns {JSX.Element|null} A React component for displaying a collectable's media (image or video), or null if the collectable is null
 */
export function CollectableMedia({ collectable, onClick, lootboxView }: { collectable: any, onClick?: (e: React.MouseEvent) => void, lootboxView?: boolean }) {
    const [containerRef, inView] = useInView({ threshold: 0.1 });
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasLoadError, setHasLoadError] = useState(false);

    if (!collectable) return unearnedCollectable();

    return (
        <div
            ref={containerRef}
            className="w-32 h-32 mx-auto rounded-lg shadow-md object-cover bg-gray-100 cursor-pointer"
            onMouseOver={() => setIsPlaying(true)}
            onMouseLeave={() => setIsPlaying(false)}
        >
            {collectable.Type === "media" && inView ? (
                !hasLoadError ? (
                    <ReactPlayer
                    src={getImageURL(collectable.Filename)}
                    playing={lootboxView || isPlaying}
                    loop={true}
                    controls={false}
                    muted={true}
                    playsInline={true}
                    style={{
                        width: "100%",
                        height: "100%",
                    }}
                    onError={() => setHasLoadError(true)}
                    onClick={onClick}
                    className="mx-auto rounded-lg shadow-md object-cover"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">Error loading media {collectable.Filename}</div>
                )
            ) : null}
            {collectable.Type === "image" && inView ? (
            <img
                src={getImageURL(collectable.Filename)}
                alt={filenameToTitle(collectable.Name)}
                className="w-32 h-32 mx-auto rounded-lg shadow-md object-cover"
                onClick={onClick}
                onError={(e) => {
                e.currentTarget.src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="%23999"><rect width="24" height="24" fill="%23f5f5f5"/><text x="12" y="12" text-anchor="middle" dy=".3em" fill="%23999">?</text></svg>';
                }}
            />
            ) : null}
        </div>
    );
}

/**
 * component for displaying a larger collectable image when the user clicks on a collectable
 * @component
 * @param {boolean} showMagnified - whether to show the magnified modal
 * @param {function} setShowMagnified - function to set the showMagnified state
 * @param {collectable} collectable - the collectable to display in magnified view
 * @returns {JSX.Element|null} A React component for displaying a magnified media modal, or null if the collectable param is null 
 */
export const MagnifiedMediaModal = ( {showMagnified, setShowMagnified, collectable}: {showMagnified: boolean, setShowMagnified: (show: boolean) => void, collectable: any} ) => {
    const [mediaUrl, setMediaUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (showMagnified) {
            const url = getImageURL(collectable.Filename);
            setMediaUrl(url); // Set media URL when the modal is shown
        }
    }, [showMagnified, collectable]);

    if (!showMagnified || !collectable) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 select-none"
            onClick={() => setShowMagnified(false)}
        >
            <div className="w-full flex flex-col items-center mb-4">
                <h1 className="text-white text-4xl font-bold text-center mb-4">
                    {filenameToTitle(collectable.Name) || 'A Rare Squid'}
                </h1>
                {collectable.Type === "media" ? (
                    <ReactPlayer
                        src={mediaUrl}
                        playing={true}
                        loop={true}
                        controls={false}
                        muted={true}
                        playsInline={true}
                        style={{ width: "100%", height: "100%" }}
                        className="rounded-xl border-4 border-yellow-400"
                    />
                ) : (
                    <img
                        src={mediaUrl}
                        alt={filenameToTitle(collectable.Name) || 'A Rare Squid'}
                        className="w-[32rem] h-[32rem] rounded-xl shadow-2xl object-contain border-4 border-yellow-400"
                    />
                )}
                <div className="text-white text-center mt-4 px-4">
                    {/* {"text"} */}
                </div>
            </div>
        </div>
    );
};

/**
 * @component
 * @returns {JSX.Element} A React component for displaying an unearned collectable
 */
export function unearnedCollectable() {
    // return a blank card with a question mark
    return (
        <div className="w-32 h-32 mx-auto rounded-lg shadow-md object-cover bg-slate-100 flex items-center justify-center hover:ignore-cursor">
            <span className="text-7xl text-gray-400 select-none font-semibold">?</span>
        </div>
    );

}

/**
 * component to view all collectables, earned and unearned
 * @component
 * @param {[]collectable} earned_collectables - json list of collectables earned by the user 
 * @param {[]collectable} all_collectables - json list of all earnable collectables
 * @param {function} handleCollectableClick - function to handle clicking on a collectable
 * @returns 
 */
export function viewAllCollectables({earned_collectables, normalized_collectables, handleCollectableClick, sortByFN}:
        {earned_collectables: any[], normalized_collectables: any[], handleCollectableClick: (collectable: any) => void, sortByFN: (a: any, b: any) => number}) {
    const earnedIds = new Set(earned_collectables.map(ec => ec.Collectable.ID));

    

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 p-4">
                {normalized_collectables.sort(sortByFN).map((nc) => {
                    let earned = earnedIds.has(nc.CollectableID)? earned_collectables.find(ec => ec.Collectable.ID === nc.CollectableID) : null;
                    // console.log(earned)
                    return earned !== null ? (
                        <div key={nc.CollectableID} className="relative">
                        <CollectableMedia
                                collectable={earned?.Collectable}
                                onClick={() => handleCollectableClick(earned.Collectable)}
                                lootboxView={false}
                            />
                            <div className="text-center mt-2">
                                <p className={`text-xs font-medium ${valueToColor(nc.Collectable.Value)} truncate max-w-full`}>
                                    <strong>{filenameToTitle(nc.Collectable.Name) || 'Unknown'}</strong>
                                </p>
                                <p className={`text-xs text-gray-300 mt-0.75`}>{valueToRarity(nc.Collectable.Value)}</p>
                                <p className="text-xs text-gray-300 mt-0.5">
                                    Quantity: {earned?.Quantity}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div key={nc.ID} className="relative">
                            {unearnedCollectable()}
                            <div className="text-center mt-2">
                                <p className="text-xs font-medium truncate max-w-full text-gray-400">
                                    ???
                                </p>
                                <p className="text-xs text-gray-400 mt-0.75 invisible">?</p>
                                <p className="text-xs text-gray-400 mt-0.5 invisible">
                                    Quantity: 0
                                </p>
                            </div>
                        </div>
                    )
                })}
        </div>
    )
}
